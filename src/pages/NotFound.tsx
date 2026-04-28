import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";

const NotFound = () => (
  <div className="min-h-screen bg-black">
    <Navigation />
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4">404</p>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter text-white mb-3">Page not found</h1>
      <p className="text-sm text-gray-400 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white no-underline transition-colors">
        Back to Home
      </Link>
    </div>
  </div>
);

export default NotFound;