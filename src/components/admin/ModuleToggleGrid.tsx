'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ModuleName, CalculatorType, PSA_DEPENDENCIES } from '@/types/enums'
import { MODULE_LABELS, MODULE_DESCRIPTIONS, CALCULATOR_LABELS, PLATFORM_MODULES, PSA_SUB_MODULES } from '@/lib/constants'

interface ModuleToggleGridProps {
  isModuleEnabled: (m: ModuleName) => boolean
  isCalcEnabled: (c: CalculatorType) => boolean
  onToggleModule: (m: ModuleName, enabled: boolean) => void
  onToggleCalc: (c: CalculatorType, enabled: boolean) => void
}

export function ModuleToggleGrid({ isModuleEnabled, isCalcEnabled, onToggleModule, onToggleCalc }: ModuleToggleGridProps) {
  const [psaExpanded, setPsaExpanded] = useState(true)
  const psaEnabled = isModuleEnabled(ModuleName.PSA)
  const enabledPsaCount = PSA_SUB_MODULES.filter((m) => isModuleEnabled(m)).length

  function handlePsaToggle(checked: boolean) {
    onToggleModule(ModuleName.PSA, checked)
    if (!checked) {
      PSA_SUB_MODULES.forEach((m) => onToggleModule(m, false))
    } else {
      onToggleModule(ModuleName.SERVICE_DESK, true)
    }
  }

  function handleSubToggle(mod: ModuleName, checked: boolean) {
    onToggleModule(mod, checked)
    if (!checked) {
      // Cascade disable dependents
      PSA_SUB_MODULES.forEach((m) => {
        if (PSA_DEPENDENCIES[m] === mod) {
          onToggleModule(m, false)
          // Second level
          PSA_SUB_MODULES.forEach((m2) => {
            if (PSA_DEPENDENCIES[m2] === m) onToggleModule(m2, false)
          })
        }
      })
    }
  }

  function isDependencyMet(mod: ModuleName): boolean {
    const dep = PSA_DEPENDENCIES[mod]
    if (dep === null || dep === undefined) return true
    return isModuleEnabled(dep)
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Left column: Platform modules + Calculators */}
      <div>
        <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Platform modules</div>
        <div className="rounded-lg border border-border bg-card">
          {PLATFORM_MODULES.map((mod) => (
            <div key={mod} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <div>
                <div className={`text-[13px] ${isModuleEnabled(mod) ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {MODULE_LABELS[mod]}
                </div>
                <div className="text-[11px] text-muted-foreground">{MODULE_DESCRIPTIONS[mod]}</div>
              </div>
              <Switch checked={isModuleEnabled(mod)} onCheckedChange={(c) => onToggleModule(mod, c)} />
            </div>
          ))}
        </div>

        <div className="mb-2.5 mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Engineering calculators</div>
        <div className="rounded-lg border border-border bg-card">
          {Object.values(CalculatorType).map((calc) => (
            <div key={calc} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className={`text-[13px] ${isCalcEnabled(calc) ? 'text-foreground' : 'text-muted-foreground'}`}>
                {CALCULATOR_LABELS[calc]}
              </span>
              <Switch checked={isCalcEnabled(calc)} onCheckedChange={(c) => onToggleCalc(calc, c)} />
            </div>
          ))}
        </div>
      </div>

      {/* Right column: PSA */}
      <div>
        <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Service engine (PSA)</div>
        <div className="rounded-lg border border-border bg-card">
          {/* PSA master toggle */}
          <div
            className="flex cursor-pointer items-center justify-between border-b border-border px-4 py-3"
            onClick={() => psaEnabled && setPsaExpanded(!psaExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-muted-foreground">
                {psaEnabled && psaExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
              <div>
                <div className={`text-sm font-medium ${psaEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  PSA — Service Engine
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {psaEnabled ? `${enabledPsaCount} of ${PSA_SUB_MODULES.length} sub-modules active` : 'All service modules disabled'}
                </div>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch checked={psaEnabled} onCheckedChange={handlePsaToggle} />
            </div>
          </div>

          {/* PSA sub-modules */}
          {psaEnabled && psaExpanded && (
            <div className="bg-blue-500/[0.03]">
              {PSA_SUB_MODULES.map((mod) => {
                const depMet = isDependencyMet(mod)
                const blocked = !depMet && !isModuleEnabled(mod)
                const depMod = PSA_DEPENDENCIES[mod]

                return (
                  <div
                    key={mod}
                    className={`flex items-center justify-between border-b border-blue-500/10 py-2.5 pl-11 pr-4 last:border-b-0 ${blocked ? 'opacity-40' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[13px] ${isModuleEnabled(mod) ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {MODULE_LABELS[mod]}
                        </span>
                        {blocked && depMod && (
                          <Badge variant="warning" className="gap-1 text-[9px]">
                            <Link2 className="h-2.5 w-2.5" />
                            Requires {MODULE_LABELS[depMod]}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{MODULE_DESCRIPTIONS[mod]}</div>
                    </div>
                    <Switch
                      checked={isModuleEnabled(mod)}
                      onCheckedChange={(c) => handleSubToggle(mod, c)}
                      disabled={blocked}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Dependency chain reference */}
        {psaEnabled && (
          <div className="mt-3.5 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Dependency chain</div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div><span className="text-foreground">Service Desk</span> &rarr; foundation for all PSA modules</div>
              <div><span className="text-foreground">Job Costing</span> &rarr; <span className="text-foreground">Invoicing</span> &rarr; <span className="text-foreground">RMR Billing</span></div>
              <div>All other sub-modules depend only on Service Desk</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
