import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={ hasError:false, error:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error, info){ console.error("ErrorBoundary:", error, info); }
  render(){
    if(this.state.hasError){
      return (
        <div className="min-h-screen grid place-items-center p-6 bg-[#fcfcf9] dark:bg-zinc-950">
          <div className="max-w-md w-full card p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 grid place-items-center mx-auto">⚠️</div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Something went wrong</h2>
            <p className="text-sm text-zinc-500">{this.state.error?.message || "Unexpected error"}</p>
            <button onClick={()=> window.location.reload()} className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium">Reload</button>
            <button onClick={()=> this.setState({hasError:false, error:null})} className="text-sm text-zinc-500 hover:text-zinc-900">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
