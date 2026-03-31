import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { colorOptions, getColorStyle } from '@/lib/colors'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export function WorkbenchQuickInput() {
  const queryClient = useQueryClient()
  const { quickInput, closeQuickInput, connectServer, refreshWorkspaceData } = useWorkbenchContext()
  const [secret, setSecret] = useState('')
  const [remember, setRemember] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(colorOptions[0] ?? 'slate')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!quickInput) {
      return
    }

    if (quickInput.kind === 'credentials') {
      setSecret('')
      setRemember(true)
      return
    }

    setName(quickInput.initialName ?? '')
    setColor(quickInput.initialColor ?? colorOptions[0] ?? 'slate')
  }, [quickInput])

  if (!quickInput) {
    return null
  }

  const handleEntitySubmit = async () => {
    if (quickInput.kind !== 'entity' || !name.trim()) {
      return
    }

    setSubmitting(true)

    try {
      if (quickInput.entityType === 'group') {
        if (quickInput.mode === 'create') {
          await window.winsshApi.groups.create({ color, name: name.trim() })
          toast.success('分组已创建')
        } else if (quickInput.entityId) {
          await window.winsshApi.groups.update(quickInput.entityId, { color, name: name.trim() })
          toast.success('分组已更新')
        }
      } else if (quickInput.mode === 'create') {
        await window.winsshApi.tags.create({ color, name: name.trim() })
        toast.success('标签已创建')
      } else if (quickInput.entityId) {
        await window.winsshApi.tags.update(quickInput.entityId, { color, name: name.trim() })
        toast.success('标签已更新')
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
        queryClient.invalidateQueries({ queryKey: ['tags'] })
      ])
      await refreshWorkspaceData()
      closeQuickInput()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const isPassword = quickInput.kind === 'credentials' && quickInput.server.authType === 'password'

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && closeQuickInput()}>
      <DialogContent
        className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
        showCloseButton={false}
      >
        {quickInput.kind === 'credentials' ? (
          <>
            <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
              <DialogTitle>{isPassword ? '输入连接密码' : '输入私钥口令'}</DialogTitle>
              <DialogDescription>
                {isPassword
                  ? `继续连接 ${quickInput.server.name} 需要输入密码。`
                  : `如私钥存在口令，请输入后继续连接 ${quickInput.server.name}。`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Secret
                </div>
                <Input
                  autoFocus
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder={isPassword ? '请输入服务器密码' : '可选，留空表示无口令'}
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-3 py-3">
                <div>
                  <div className="text-sm font-medium">写入系统钥匙串</div>
                  <div className="text-xs text-muted-foreground">后续连接可直接复用。</div>
                </div>
                <Switch checked={remember} onCheckedChange={setRemember} />
              </div>
            </div>
            <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
              <Button variant="ghost" disabled={submitting} onClick={closeQuickInput}>
                取消
              </Button>
              <Button
                disabled={submitting}
                onClick={async () => {
                  if (isPassword && !secret) {
                    toast.error('密码不能为空')
                    return
                  }

                  setSubmitting(true)
                  try {
                    await connectServer(quickInput.server, {
                      passphrase: isPassword ? undefined : secret,
                      password: isPassword ? secret : undefined,
                      rememberPassphrase: isPassword ? undefined : remember,
                      rememberPassword: isPassword ? remember : undefined,
                      serverId: quickInput.server.id
                    })
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                连接
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
              <DialogTitle>
                {quickInput.mode === 'create'
                  ? `新建${quickInput.entityType === 'group' ? '分组' : '标签'}`
                  : `重命名${quickInput.entityType === 'group' ? '分组' : '标签'}`}
              </DialogTitle>
              <DialogDescription>
                使用轻量输入流快速维护 Explorer 中的组织结构。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Name
                </div>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={quickInput.entityType === 'group' ? 'Production' : 'MySQL'}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Color
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {colorOptions.map((option) => {
                    const style = getColorStyle(option)
                    return (
                      <Button
                        key={option}
                        variant="outline"
                        size="sm"
                        className={`justify-start ${color === option ? `${style.badge} ${style.ring} ring-1` : 'bg-transparent'}`}
                        onClick={() => setColor(option)}
                      >
                        <span className={`size-2 rounded-full ${style.dot}`} />
                        <span className="capitalize">{option}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
              <Button variant="ghost" disabled={submitting} onClick={closeQuickInput}>
                取消
              </Button>
              <Button disabled={submitting || !name.trim()} onClick={() => void handleEntitySubmit()}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                保存
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
