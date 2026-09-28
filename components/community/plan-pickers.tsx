"use client";

import { Select } from "radix-ui";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import "./plan-pickers.css";

// Radix no admite "" como valor de una opción: «todos» viaja con este centinela y sale como "".
const ALL = "__all";

export type PickOption = { value: string; label: string; mark?: string; count?: number };

/* Los desplegables de los filtros de planes: una píldora con su icono y un menú propio en vez del select nativo. */
export function PickSelect({ label, icon: Icon, value, options, onChange, active = !!value }: { label: string; icon: LucideIcon; value: string; options: readonly PickOption[]; onChange: (value: string) => void; active?: boolean }) {
  return <Select.Root value={value || ALL} onValueChange={next => onChange(next === ALL ? "" : next)}>
    <Select.Trigger className={`pk-trigger ${active ? "pk-active" : ""}`} aria-label={label}>
      <span className="pk-icon" aria-hidden="true"><Icon /></span>
      <span className="pk-text"><small>{label}</small><Select.Value /></span>
      <Select.Icon asChild><ChevronDown className="pk-chevron" aria-hidden="true" /></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="pk-menu" position="popper" side="bottom" align="start" sideOffset={8} collisionPadding={16}>
        <Select.Viewport className="pk-viewport">
          {options.map(option => <Select.Item key={option.value || ALL} value={option.value || ALL} className={`pk-item ${option.count === 0 ? "pk-empty" : ""}`}>
            {option.mark && <span className="pk-mark" aria-hidden="true">{option.mark}</span>}
            <Select.ItemText>{option.label}</Select.ItemText>
            {option.count !== undefined && <span className="pk-count">{option.count}</span>}
            <Select.ItemIndicator className="pk-check"><Check aria-hidden="true" /></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}

export function PickToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className={`pk-toggle ${checked ? "pk-active" : ""}`}>
    <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span className="pk-switch" aria-hidden="true" />{label}
  </label>;
}
