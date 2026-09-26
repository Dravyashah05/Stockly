import { Link } from "react-router-dom";
import { Package } from "lucide-react";
export default function NotFound(){
  return (
    <div className="min-h-[50vh] grid place-items-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400"><Package size={28}/></div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Page not found</h1>
        <p className="text-sm text-zinc-500">The page you’re looking for doesn’t exist.</p>
        <Link to="/products" className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium">Go to Products</Link>
      </div>
    </div>
  )
}
