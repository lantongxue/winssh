import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { PencilLine, Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { ServerGroup, Tag } from '@shared/types'
import {
  groupSchema,
  tagSchema,
  type GroupFormValues,
  type TagFormValues
} from '@shared/validation'
import { colorOptions, getColorStyle } from '@/lib/colors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

type Entity = ServerGroup | Tag

interface EntityManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'group' | 'tag'
  items: Entity[]
  onCreate: (input: GroupFormValues | TagFormValues) => Promise<void>
  onUpdate: (id: string, input: GroupFormValues | TagFormValues) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const defaults = { name: '', color: 'slate' }

export function EntityManagerDialog({
  open,
  onOpenChange,
  type,
  items,
  onCreate,
  onUpdate,
  onDelete
}: EntityManagerDialogProps) {
  const [editingItem, setEditingItem] = useState<Entity | null>(null)
  const schema = type === 'group' ? groupSchema : tagSchema
  const entityLabel = type === 'group' ? '分组' : '标签'
  const entityDescription =
    type === 'group' ? '维护服务器分组结构。' : '维护跨服务器标签，用于快速筛选和组织。'
  const form = useForm<{ name: string; color: string }>({
    resolver: zodResolver(schema as never),
    defaultValues: defaults
  })
  const watchedName = form.watch('name')
  const watchedColor = form.watch('color')

  useEffect(() => {
    if (!open) {
      setEditingItem(null)
      form.reset(defaults)
    }
  }, [form, open])

  const submitLabel = editingItem ? `保存${entityLabel}` : `创建${entityLabel}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(880px,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] max-w-none gap-0 rounded-2xl p-0 sm:w-[min(880px,calc(100vw-2rem))] sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-14 sm:px-5">
          <DialogTitle>{entityLabel}管理</DialogTitle>
          <DialogDescription>{entityDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 pb-3 pt-3 sm:gap-4 sm:px-4 sm:pb-4 sm:pt-4 lg:grid-cols-[minmax(240px,30%)_minmax(0,1fr)]">
          <section className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border bg-card/70">
            <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
              <div className="text-sm font-medium text-muted-foreground">当前{entityLabel}</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{entityLabel}列表</h3>
                <Badge variant="secondary">{items.length} 个</Badge>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-3 p-3 sm:p-4">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
                    还没有{entityLabel}，右侧表单可以立即创建。
                  </div>
                ) : null}
                {items.map((item) => {
                  const style = getColorStyle(item.color)
                  const isEditing = editingItem?.id === item.id
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        isEditing
                          ? 'border-primary/35 bg-primary/5 shadow-sm'
                          : 'bg-muted/20 hover:bg-muted/35'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${style.dot}`} />
                          <div className="min-w-0 space-y-1">
                            <div className="truncate text-sm font-medium">{item.name}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="capitalize">{item.color}</span>
                              {isEditing ? <span className="text-primary">正在编辑</span> : null}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={style.badge}>
                          {item.color}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem(item)
                            form.reset({ name: item.name, color: item.color })
                          }}
                        >
                          <PencilLine className="size-4" />
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (editingItem?.id === item.id) {
                              setEditingItem(null)
                              form.reset(defaults)
                            }
                            await onDelete(item.id)
                          }}
                        >
                          <Trash2 className="size-4" />
                          删除
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                {editingItem ? (
                  <PencilLine className="mt-0.5 size-4 text-primary" />
                ) : (
                  <Plus className="mt-0.5 size-4 text-primary" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold">
                    {editingItem ? `编辑${entityLabel}` : `新增${entityLabel}`}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {editingItem
                      ? `修改当前${entityLabel}的名称和颜色。`
                      : `创建新的${entityLabel}，用于组织服务器资源。`}
                  </p>
                </div>
              </div>
            </div>

            <Form {...form}>
              <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={form.handleSubmit(async (values) => {
                  if (editingItem) {
                    await onUpdate(editingItem.id, values as GroupFormValues | TagFormValues)
                  } else {
                    await onCreate(values as GroupFormValues | TagFormValues)
                  }

                  setEditingItem(null)
                  form.reset(defaults)
                })}
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel>名称</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={type === 'group' ? '例如: Production' : '例如: MySQL'}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-3">
                            <FormLabel>颜色</FormLabel>
                            <span className="text-xs text-muted-foreground">
                              选择一个便于识别的预设色
                            </span>
                          </div>
                          <FormControl>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {colorOptions.map((color) => {
                                const style = getColorStyle(color)
                                const active = field.value === color
                                return (
                                  <Button
                                    key={color}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={`h-auto justify-start rounded-xl px-3 py-3 ${
                                      active ? `${style.badge} ${style.ring} ring-1` : 'bg-muted/20'
                                    }`}
                                    onClick={() => field.onChange(color)}
                                  >
                                    <span className={`size-2.5 rounded-full ${style.dot}`} />
                                    <span className="capitalize">{color}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <div className="text-sm font-medium">预览</div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className={getColorStyle(watchedColor).badge}>
                          {watchedName || `${entityLabel}示例`}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          创建后可在服务器列表里直接筛选。
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t px-4 py-3 sm:px-5 sm:py-4">
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {editingItem ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingItem(null)
                          form.reset(defaults)
                        }}
                      >
                        取消编辑
                      </Button>
                    ) : null}
                    <Button type="submit">{submitLabel}</Button>
                  </div>
                </div>
              </form>
            </Form>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
