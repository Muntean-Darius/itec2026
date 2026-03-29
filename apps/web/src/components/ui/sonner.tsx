"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      visibleToasts={5}
      expand
      closeButton
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-elevated group-[.toaster]:text-text-primary group-[.toaster]:border-border-default group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-text-secondary",
          actionButton:
            "group-[.toast]:bg-brand group-[.toast]:text-brand-foreground",
          cancelButton:
            "group-[.toast]:bg-surface group-[.toast]:text-text-secondary",
          closeButton:
            "group-[.toast]:bg-elevated group-[.toast]:border-border-default group-[.toast]:text-text-secondary group-[.toast]:hover:text-text-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
