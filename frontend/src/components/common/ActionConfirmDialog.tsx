import { TbAlertTriangle, TbSend } from 'react-icons/tb'
import AppModal from './AppModal'

interface ActionConfirmDialogProps {
    open: boolean
    tone?: 'action' | 'danger'
    title: string
    description: string
    confirmLabel: string
    pendingLabel?: string
    isPending?: boolean
    showCancel?: boolean
    onCancel: () => void
    onConfirm: () => void
}

export default function ActionConfirmDialog({
    open,
    tone = 'action',
    title,
    description,
    confirmLabel,
    pendingLabel = '처리 중…',
    isPending = false,
    showCancel = true,
    onCancel,
    onConfirm,
}: ActionConfirmDialogProps) {
    const Icon = tone === 'danger' ? TbAlertTriangle : TbSend

    return (
        <AppModal
            open={open}
            role="alertdialog"
            size="sm"
            tone={tone === 'danger' ? 'danger' : 'default'}
            title={title}
            titleIcon={<Icon />}
            descriptionId="actionAlertDescription"
            closeDisabled={isPending}
            onClose={onCancel}
            bodyClassName="action-alert-content"
            actions={[
                ...(showCancel
                    ? [
                          {
                              id: 'cancel',
                              label: '취소',
                              variant: 'secondary' as const,
                              disabled: isPending,
                              autoFocus: tone === 'danger',
                              onClick: onCancel,
                          },
                      ]
                    : []),
                {
                    id: 'confirm',
                    label: confirmLabel,
                    pendingLabel,
                    variant:
                        tone === 'danger'
                            ? ('danger' as const)
                            : ('primary' as const),
                    pending: isPending,
                    autoFocus: tone !== 'danger',
                    onClick: onConfirm,
                },
            ]}
        >
            <p id="actionAlertDescription">{description}</p>
        </AppModal>
    )
}
