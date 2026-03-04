"use client"

import { useState, useEffect } from "react"
import { Download, FileSpreadsheet, Filter, Package, CheckSquare, Square, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export interface ExportFilter {
    label: string
    value: string
}

export interface ExportCSVModalProps {
    /** Título que aparece en el modal, ej: "Exportar Productos" */
    title: string
    /** Descripción secundaria del modal */
    description?: string
    /** Prefijo del nombre del archivo, ej: "productos" -> productos_2026-03-03.csv */
    filenamePrefix: string
    /** Encabezados de las columnas del CSV */
    headers: string[]
    /** Filas de datos — cada fila es un array de valores */
    rows: (any)[][]
    /** Filtros activos a mostrar en el resumen */
    filters: ExportFilter[]
    /** Cantidad de items que se van a exportar */
    itemCount: number
    /** Etiqueta para los items, ej: "productos", "ofertas" */
    itemLabel?: string
    /** Controla visibilidad del modal */
    open: boolean
    /** Callback cuando se abre/cierra el modal */
    onOpenChange: (open: boolean) => void
    /**
     * Callback asíncrono opcional. Si se pasa, el modal delega la exportación
     * al componente padre (útil cuando los datos se deben fetch-ear al momento de exportar).
     * Recibe los índices de columnas seleccionadas.
     */
    onExport?: (selectedColumnIndices: number[]) => Promise<void>
}

export function escapeCSVValue(val: any): string {
    const str = String(val ?? "")
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

export function downloadCSV(content: string, filenamePrefix: string) {
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const today = new Date().toISOString().slice(0, 10)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filenamePrefix}_${today}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function ExportCSVModal({
    title,
    description,
    filenamePrefix,
    headers,
    rows,
    filters,
    itemCount,
    itemLabel = "items",
    open,
    onOpenChange,
    onExport,
}: ExportCSVModalProps) {
    const [selectedColumns, setSelectedColumns] = useState<Set<number>>(
        () => new Set(headers.map((_, i) => i))
    )
    const [isExporting, setIsExporting] = useState(false)

    // Reset selections when headers change or modal opens
    useEffect(() => {
        if (open) {
            setSelectedColumns(new Set(headers.map((_, i) => i)))
            setIsExporting(false)
        }
    }, [open, headers])

    const allSelected = selectedColumns.size === headers.length
    const noneSelected = selectedColumns.size === 0

    const toggleColumn = (index: number) => {
        setSelectedColumns((prev) => {
            const next = new Set(prev)
            if (next.has(index)) {
                next.delete(index)
            } else {
                next.add(index)
            }
            return next
        })
    }

    const selectAll = () => setSelectedColumns(new Set(headers.map((_, i) => i)))
    const deselectAll = () => setSelectedColumns(new Set())

    const handleExport = async () => {
        const selectedIndices = Array.from(selectedColumns).sort((a, b) => a - b)

        if (onExport) {
            setIsExporting(true)
            try {
                await onExport(selectedIndices)
            } catch (error) {
                console.error("Error exporting:", error)
            } finally {
                setIsExporting(false)
            }
            return
        }

        // Exportación sincrónica (datos ya disponibles en rows)
        const filteredHeaders = selectedIndices.map((i) => headers[i])
        const filteredRows = rows.map((r) => selectedIndices.map((i) => r[i]))

        const csvContent = [
            filteredHeaders.map(escapeCSVValue).join(","),
            ...filteredRows.map((r) => r.map(escapeCSVValue).join(",")),
        ].join("\n")

        downloadCSV(csvContent, filenamePrefix)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        {title}
                    </DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {itemCount ? <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <Package className="w-8 h-8 text-emerald-600 shrink-0" />
                        <div>
                            <p className="text-2xl font-bold text-emerald-700">
                                {itemCount}
                            </p>
                            <p className="text-sm text-emerald-600">
                                {itemLabel} a exportar
                            </p>
                        </div>
                    </div> : null}

                    {filters.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                <Filter className="w-4 h-4 text-gray-500" />
                                Filtros aplicados
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {filters.map((f) => (
                                    <Badge
                                        key={f.label}
                                        variant="secondary"
                                        className="px-2.5 py-1 bg-gray-100 text-gray-700 border border-gray-200 text-xs"
                                    >
                                        <span className="font-medium">{f.label}:</span>&nbsp;
                                        {f.value}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- Selección de campos --- */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-700">
                                Campos a exportar
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={allSelected ? deselectAll : selectAll}
                                className="text-xs h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                            >
                                {allSelected ? (
                                    <>
                                        <Square className="w-3.5 h-3.5 mr-1" />
                                        Deseleccionar todos
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-3.5 h-3.5 mr-1" />
                                        Seleccionar todos
                                    </>
                                )}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            {headers.map((header, index) => (
                                <label
                                    key={index}
                                    className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900"
                                >
                                    <Checkbox
                                        checked={selectedColumns.has(index)}
                                        onCheckedChange={() => toggleColumn(index)}
                                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                    />
                                    {header}
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 text-right">
                            {selectedColumns.size} de {headers.length} campos seleccionados
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                        className="w-full sm:w-auto"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={noneSelected || isExporting}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 w-full sm:w-auto"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Exportando...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Exportar CSV
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
