import * as React from "react"

export function Popover({ children }: { children: React.ReactNode }) {
  return <div className="relative inline-block">{children}</div>
}

export function PopoverTrigger({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function PopoverContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-50 mt-2 rounded-md border bg-white p-2 shadow">
      {children}
    </div>
  )
}
