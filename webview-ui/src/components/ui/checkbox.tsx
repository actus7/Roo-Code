"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const checkboxVariants = cva(
	"peer h-4 w-4 shrink-0 rounded-sm border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"border-vscode-foreground data-[state=checked]:bg-vscode-foreground data-[state=checked]:text-primary-foreground",
				description:
					"border-vscode-descriptionForeground data-[state=checked]:bg-vscode-descriptionForeground data-[state=checked]:text-white",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

export interface CheckboxProps extends VariantProps<typeof checkboxVariants> {
	checked?: boolean
	onCheckedChange?: (checked: boolean) => void
	className?: string
	disabled?: boolean
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
	({ className, variant, checked, onCheckedChange, disabled, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(checkboxVariants({ variant, className }))}
			data-state={checked ? "checked" : "unchecked"}
			onClick={() => !disabled && onCheckedChange && onCheckedChange(!checked)}
			{...props}
		>
			{checked && (
				<div className={cn("flex items-center justify-center text-current")}>
					<Check className="h-4 w-4 text-vscode-background" />
				</div>
			)}
		</div>
	),
)
Checkbox.displayName = "Checkbox"

export { Checkbox, checkboxVariants }
