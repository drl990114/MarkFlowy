import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/cn'
import {
  FileOutput,
  Heart,
  History,
  Image,
  Keyboard,
  Palette,
  Settings2,
  Sparkles,
  SquareCode,
  SquarePen,
  SwatchBook,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { SettingData } from '../settingMap'
import type { SettingCategoryKey } from '../settingSearch'

const navigationSections = [
  { id: 'preferences', i18nKey: 'settings.navigation.preferences' },
  { id: 'writing', i18nKey: 'settings.navigation.writing' },
  { id: 'ai', i18nKey: 'settings.navigation.ai' },
  { id: 'help', i18nKey: 'settings.navigation.help' },
] as const

// Every settings category needs a section and an icon before it can be added.
const navigationItems: Record<
  SettingCategoryKey,
  { section: (typeof navigationSections)[number]['id']; icon: LucideIcon }
> = {
  general: { section: 'preferences', icon: Settings2 },
  display: { section: 'preferences', icon: Palette },
  themeStore: { section: 'preferences', icon: SwatchBook },
  keyboard: { section: 'preferences', icon: Keyboard },
  editor: { section: 'writing', icon: SquarePen },
  snippets: { section: 'writing', icon: SquareCode },
  image: { section: 'writing', icon: Image },
  export: { section: 'writing', icon: FileOutput },
  history: { section: 'writing', icon: History },
  ai: { section: 'ai', icon: Sparkles },
  copilot: { section: 'ai', icon: WandSparkles },
  support: { section: 'help', icon: Heart },
}

const navigationKeys = Object.keys(navigationItems) as SettingCategoryKey[]

export interface SettingNavigationProps {
  settingMap: SettingData
  activeCategory: SettingCategoryKey
  onSelect: (category: SettingCategoryKey, navigationItemId: string) => void
}

export function SettingNavigation({
  settingMap,
  activeCategory,
  onSelect,
}: SettingNavigationProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4 pt-1 pb-2'>
      {navigationSections.map((section) => {
        const categories = navigationKeys.filter(
          (key) => navigationItems[key].section === section.id && settingMap[key],
        )
        if (categories.length === 0) return null

        const headingId = `setting-navigation-${section.id}`

        return (
          <div data-slot='setting-navigation-group' key={section.id}>
            <h3
              className='m-0 mb-1 px-2 text-ui-caption font-medium text-muted-foreground'
              id={headingId}
            >
              {t(section.i18nKey)}
            </h3>
            <ul aria-labelledby={headingId} className='m-0 list-none space-y-0.5 p-0'>
              {categories.map((category) => {
                const { icon: Icon } = navigationItems[category]
                const selected = category === activeCategory
                const navigationItemId = `setting-category-${category}`

                return (
                  <li key={category}>
                    <Button
                      aria-current={selected ? 'page' : undefined}
                      className={cn(
                        'h-8 w-full justify-start gap-2 rounded-md px-2 text-left text-ui-control font-normal text-foreground shadow-none',
                        selected
                          ? 'bg-control-selected font-medium text-content-primary hover:bg-control-selected'
                          : 'bg-transparent hover:bg-control-ghost-hover hover:text-content-primary',
                      )}
                      id={navigationItemId}
                      variant='ghost'
                      onClick={() => onSelect(category, navigationItemId)}
                    >
                      <Icon aria-hidden className='size-4' strokeWidth={1.75} />
                      <span className='min-w-0 truncate capitalize'>
                        {t(settingMap[category].i18nKey)}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
