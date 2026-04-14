import { Link } from 'react-router-dom'

export function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">403</h1>
        <p className="text-zinc-400 mb-4">
          You don't have permission to access this page.
        </p>
        <Link
          to="/dashboard"
          className="text-teal-600 hover:text-teal-800 underline"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
