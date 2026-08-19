import React from 'react'
import * as LucideIcons from 'lucide-react'

interface DynamicIconProps extends LucideIcons.LucideProps {
  name: string
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Tag
  return <IconComponent {...props} />
}

export const AVAILABLE_ICONS = [
  'Home',
  'Users',
  'Truck',
  'Megaphone',
  'Receipt',
  'Car',
  'FileText',
  'Zap',
  'ShoppingBag',
  'Briefcase',
  'TrendingUp',
  'PlusCircle',
  'CreditCard',
  'DollarSign',
  'Coffee',
  'Shield',
  'Cpu',
  'Smartphone',
  'Globe',
  'Package',
  'PieChart',
  'Smile',
  'Tag',
  'Award',
]
