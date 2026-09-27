import { Link } from "react-router-dom";
import AppLogo from "../components/ui/AppLogo";

export default function NotFound(){
  return (
    <div className="min-h-[50vh] grid place-items-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex justify-center">
          <AppLogo size="xl" className="shadow-lg" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Page not found</h1>
        <p className="text-sm text-zinc-500">The page you’re looking for doesn’t exist.</p>
        <Link to="/products" className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium">Go to Products</Link>
      </div>
    </div>
  )
}
