export function GysLogo({ className, completeName }: { className?: string, completeName?: boolean }) {
    const GESTION = completeName ? "Gestión" : "G"
    const STOCK = completeName ? "Stock" : "S"
    return (
        <a href="https://gestionystock.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            <span className={`font-[Crimson] text-2xl font-bold text-title ${className ?? ""}`}>{GESTION}<span className="text-title-blue" style={{ fontSize: '0.75em' }}>&</span>{STOCK}</span>
        </a>
    )
}