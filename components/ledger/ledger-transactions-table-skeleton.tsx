import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  rows?: number
  className?: string
}

export function LedgerTransactionsTableSkeleton({ rows = 8, className }: Props) {
  return (
    <div className={className}>
      <Table className="min-w-[640px] lg:min-w-0">
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="bg-neutral-950/95 px-3 text-white/55 lg:px-4">Fecha</TableHead>
            <TableHead className="bg-neutral-950/95 px-3 text-white/55 lg:px-4">Comercio</TableHead>
            <TableHead className="bg-neutral-950/95 px-3 text-right text-white/55 lg:px-4">Monto</TableHead>
            <TableHead className="bg-neutral-950/95 px-3 text-white/55 lg:px-4">Tipo</TableHead>
            <TableHead className="bg-neutral-950/95 px-3 text-white/55 lg:px-4">Origen</TableHead>
            <TableHead className="bg-neutral-950/95 px-3 text-white/55 lg:px-4">Cat.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i} className="border-white/10 hover:bg-transparent">
              <TableCell className="px-3 py-3 lg:px-4">
                <Skeleton className="h-3.5 w-14 rounded bg-white/10" />
              </TableCell>
              <TableCell className="px-3 py-3 lg:px-4">
                <Skeleton className="h-3.5 w-44 max-w-[12rem] rounded bg-white/10" />
              </TableCell>
              <TableCell className="px-3 py-3 text-right lg:px-4">
                <Skeleton className="ml-auto h-3.5 w-20 rounded bg-white/10" />
              </TableCell>
              <TableCell className="px-3 py-3 lg:px-4">
                <Skeleton className="h-3.5 w-16 rounded bg-white/10" />
              </TableCell>
              <TableCell className="px-3 py-3 lg:px-4">
                <Skeleton className="h-3.5 w-20 rounded bg-white/10" />
              </TableCell>
              <TableCell className="px-3 py-3 lg:px-4">
                <Skeleton className="h-3.5 w-14 rounded bg-white/10" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
