# Keep line numbers for crash reports (tiny cost, big debug value).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor uses reflection to load plugins — never strip these.
-keep class com.getcapacitor.** { *; }
-keep class com.stockly.app.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
    @com.getcapacitor.PluginMethod *;
}
# WebView JS bridge used by Capacitor — keep the interface surface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
