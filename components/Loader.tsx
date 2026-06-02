export default function Loader({ label = 'laden' }: { label?: string }) {
  return (
    <div className="loader">
      <div className="loader__marks">
        <span className="loader__mark" style={{ animationDelay: '0ms' }}>◆</span>
        <span className="loader__mark" style={{ animationDelay: '200ms' }}>◆</span>
        <span className="loader__mark" style={{ animationDelay: '400ms' }}>◆</span>
      </div>
      <span className="loader__label">{label}</span>
    </div>
  )
}
