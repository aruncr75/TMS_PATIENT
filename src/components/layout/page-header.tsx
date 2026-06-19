import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  /** Show a back button (navigates to the previous entry). Default true. */
  back?: boolean
}

// Sticky header for inner pages: back button + title.
export function PageHeader({ title, back = true }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-3">
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="-ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
    </header>
  )
}
