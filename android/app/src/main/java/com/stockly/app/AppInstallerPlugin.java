package com.stockly.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final String CHANNEL_ID = "stockly_app_updates";
    private static final int NOTIF_ID = 9991;
    // Binder traffic is the main source of download jank — 500ms is plenty.
    private static final long PROGRESS_THROTTLE_MS = 500;
    private static final int IO_BUFFER_SIZE = 16384;

    @Override
    protected void handleOnDestroy() {
        try {
            executor.shutdownNow();
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean can = getContext().getPackageManager().canRequestPackageInstalls();
            ret.put("canInstall", can);
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open install settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        String version = call.getString("version", "latest");
        // When false, only download + verify (no installer, no ready
        // notification) so the web layer can check the app version first
        // and then show the update explicitly.
        boolean autoInstall = call.getBoolean("autoInstall", true);

        if (downloadUrl == null || downloadUrl.isEmpty()) {
            call.reject("APK download URL is required");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                Context context = getContext();
                createNotificationChannel(context);
                dismissNotification(context);

                // Prepare file in cache
                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File apkFile = new File(cacheDir, "stockly-v" + version + ".apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                // Connect and download
                URL url = new URL(downloadUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setRequestProperty("User-Agent", "Stockly-Android-Updater");
                connection.connect();

                int responseCode = connection.getResponseCode();
                if (responseCode < 200 || responseCode >= 300) {
                    throw new Exception("APK server returned HTTP " + responseCode + " for " + downloadUrl);
                }
                String contentType = connection.getContentType();
                if (contentType != null && contentType.contains("text/html")) {
                    throw new Exception("APK URL returned HTML instead of APK (got Content-Type: " + contentType + "). The file may be behind an SPA rewrite — see vercel.json.");
                }

                int fileLength = connection.getContentLength();
                long total = 0;
                int count;
                long lastNotifyTime = 0;

                try (
                    InputStream input = new BufferedInputStream(connection.getInputStream(), IO_BUFFER_SIZE);
                    OutputStream output = new FileOutputStream(apkFile)
                ) {
                    byte[] data = new byte[IO_BUFFER_SIZE];

                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);

                        int progress = fileLength > 0 ? (int) ((total * 100) / fileLength) : -1;
                        long now = System.currentTimeMillis();
                        if (now - lastNotifyTime > PROGRESS_THROTTLE_MS || progress == 100) {
                            lastNotifyTime = now;
                            updateProgressNotification(context, progress, version);

                            JSObject progressObj = new JSObject();
                            progressObj.put("progress", progress);
                            progressObj.put("bytesDownloaded", total);
                            progressObj.put("totalBytes", fileLength);
                            notifyListeners("downloadProgress", progressObj);
                        }
                    }
                    output.flush();
                }

                // Guard against SPA-fallback HTML (index.html ~3KB) being saved as .apk
                if (!apkFile.exists() || apkFile.length() < 1_000_000) {
                    long size = apkFile.exists() ? apkFile.length() : -1;
                    dismissNotification(getContext());
                    throw new Exception("Downloaded file is too small (" + size + " bytes) — expected APK binary. URL: " + downloadUrl);
                }

                // Notify complete (path + verified byte size so the web layer
                // can show the downloaded file in the notification shade).
                long finalSize = apkFile.length();
                JSObject completeObj = new JSObject();
                completeObj.put("success", true);
                completeObj.put("path", apkFile.getAbsolutePath());
                completeObj.put("name", apkFile.getName());
                completeObj.put("sizeBytes", finalSize);
                completeObj.put("version", version);
                notifyListeners("downloadComplete", completeObj);

                // Launch package installer immediately (unless the caller wants
                // to verify + version-check first, then show the update).
                final boolean launchInstaller = autoInstall;
                mainHandler.post(() -> {
                    if (launchInstaller) {
                        triggerInstall(context, apkFile, version);
                    } else {
                        // Clear the ongoing progress notification — the web
                        // layer posts its own downloaded-file notification.
                        dismissNotification(context);
                    }
                    call.resolve(completeObj);
                });

            } catch (Exception e) {
                mainHandler.post(() -> {
                    dismissNotification(getContext());
                    JSObject err = new JSObject();
                    err.put("error", e.getMessage());
                    notifyListeners("downloadError", err);
                    call.reject("Download and install failed: " + e.getMessage());
                });
            } finally {
                if (connection != null) {
                    try { connection.disconnect(); } catch (Exception ignored) {}
                }
            }
        });
    }

    @PluginMethod
    public void installExistingApk(PluginCall call) {
        String filePath = call.getString("path");
        if (filePath == null) {
            call.reject("APK path required");
            return;
        }
        File apkFile = new File(filePath);
        if (!apkFile.exists()) {
            call.reject("APK file not found");
            return;
        }
        triggerInstall(getContext(), apkFile, call.getString("version", "update"));
        call.resolve();
    }

    /**
     * Verify a previously downloaded APK still exists and report its size.
     * Lets the web layer show the downloaded file + run the version check
     * before prompting the install, even if the app restarted mid-flow.
     */
    @PluginMethod
    public void getDownloadedFileInfo(PluginCall call) {
        try {
            String filePath = call.getString("path");
            String version = call.getString("version", "");
            File apkFile = null;
            if (filePath != null && !filePath.isEmpty()) {
                apkFile = new File(filePath);
            } else {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir() != null
                        ? context.getExternalCacheDir() : context.getCacheDir();
                File byVersion = (version != null && !version.isEmpty())
                        ? new File(cacheDir, "stockly-v" + version + ".apk") : null;
                if (byVersion != null && byVersion.exists()) {
                    apkFile = byVersion;
                } else if (cacheDir != null && cacheDir.exists()) {
                    File[] matches = cacheDir.listFiles((dir, name) ->
                            name.startsWith("stockly-v") && name.endsWith(".apk"));
                    if (matches != null) {
                        long newest = -1;
                        for (File f : matches) {
                            if (f.lastModified() > newest) { newest = f.lastModified(); apkFile = f; }
                        }
                    }
                }
            }
            JSObject ret = new JSObject();
            boolean exists = apkFile != null && apkFile.exists();
            ret.put("exists", exists);
            ret.put("path", (apkFile != null) ? apkFile.getAbsolutePath() : "");
            ret.put("name", (apkFile != null) ? apkFile.getName() : "");
            ret.put("sizeBytes", exists ? apkFile.length() : 0);
            ret.put("validApk", exists && apkFile.length() >= 1_000_000);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("File check failed: " + e.getMessage());
        }
    }

    private void triggerInstall(Context context, File apkFile, String version) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

            // Post notification with ready-to-install PendingIntent
            showInstallReadyNotification(context, apkUri, version, installIntent);

            // Directly launch the native package installer
            context.startActivity(installIntent);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Stockly App Updates",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows download and installation status for Stockly updates");
            channel.enableVibration(false);
            channel.setShowBadge(false);
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void updateProgressNotification(Context context, int progress, String version) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher_round)
                .setContentTitle("Downloading Stockly v" + version)
                .setContentText(progress >= 0 ? progress + "% downloaded" : "Downloading update package…")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setColor(0xFF4F46E5);

        if (progress >= 0) {
            builder.setProgress(100, progress, false);
        } else {
            builder.setProgress(0, 0, true);
        }

        manager.notify(NOTIF_ID, builder.build());
    }

    private void showInstallReadyNotification(Context context, Uri apkUri, String version, Intent installIntent) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(context, 9992, installIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher_round)
                .setContentTitle("Stockly v" + version + " Ready")
                .setContentText("Tap to install the updated version immediately.")
                .setAutoCancel(true)
                .setOngoing(false)
                .setColor(0xFF10B981)
                .setContentIntent(pendingIntent);

        manager.notify(NOTIF_ID, builder.build());
    }

    private void dismissNotification(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(NOTIF_ID);
        }
    }
}
