import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ConnectionRequest, Server } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from '@/components/ui/switch'

const schema = z.object({
  secret: z.string().optional(),
  remember: z.boolean().default(false)
})

interface ConnectionSecretsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server: Server | null
  credentialStorageAvailable: boolean
  onConfirm: (request: ConnectionRequest) => Promise<void>
}

export function ConnectionSecretsDialog({
  open,
  onOpenChange,
  server,
  credentialStorageAvailable,
  onConfirm
}: ConnectionSecretsDialogProps) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      secret: '',
      remember: credentialStorageAvailable
    }
  })

  useEffect(() => {
    if (open) {
      form.reset({
        secret: '',
        remember: credentialStorageAvailable
      })
    }
  }, [credentialStorageAvailable, form, open])

  const isPassword = server?.authType === 'password'
  const isSubmitting = form.formState.isSubmitting

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>{isPassword ? '输入连接密码' : '输入私钥口令'}</DialogTitle>
          <DialogDescription>
            {isPassword
              ? '该服务器没有可用的已保存密码，连接前需要先输入。'
              : '如果私钥存在口令，请在这里填写。留空代表该私钥没有口令。'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (values) => {
              if (!server) {
                return
              }

              if (isPassword && !values.secret) {
                form.setError('secret', { message: '密码不能为空' })
                return
              }

              await onConfirm({
                serverId: server.id,
                password: isPassword ? values.secret : undefined,
                passphrase: isPassword ? undefined : values.secret,
                rememberPassword: isPassword ? values.remember : undefined,
                rememberPassphrase: isPassword ? undefined : values.remember
              })
            })}
          >
            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem className="sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
                  <FormLabel className="sm:text-right">{isPassword ? '密码' : '口令'}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder={isPassword ? '请输入服务器密码' : '可选'}
                    />
                  </FormControl>
                  <FormMessage className="sm:col-start-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remember"
              render={({ field }) => (
                <FormItem className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">写入系统钥匙串</div>
                      <div className="text-sm text-muted-foreground">
                        {credentialStorageAvailable
                          ? '后续连接将直接复用保存的密钥。'
                          : '当前环境没有可用的系统钥匙串。'}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value && credentialStorageAvailable}
                        disabled={!credentialStorageAvailable}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            {isSubmitting ? (
              <div className="relative overflow-hidden rounded-lg border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-200">
                <div className="connection-sheen absolute inset-y-0 left-0 w-16 bg-linear-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
                <div className="relative flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>正在提交凭据并建立连接…</span>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {isSubmitting ? '连接中' : '连接'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
