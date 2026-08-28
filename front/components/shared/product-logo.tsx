export function ProductLogo({ className }: { className?: string }) {
    return (
        <a href="https://comercios.gestionystock.com" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            <span className={`font-[Crimson] text-2xl font-bold text-title ${className ?? ""}`}>Gestor<span className="text-title-blue" style={{ fontSize: '0.75em' }}> de </span> Comercios</span>
        </a>
    )
}