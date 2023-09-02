import { MfDialog } from '@/components/UI/Dialog'
import { Button, TextField, Grid } from '@mui/material'
import { emit, listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useState } from 'react'

function TableDialog() {
  const [open, setOpen] = useState(false)
  const [rowsCount, setRowsCount] = useState(4)
  const [columnsCount, setColumnsCount] = useState(4)

  useEffect(() => {
    const unlisten = listen('editor:dialog_create_table', () => {
      setOpen(true)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const handleOk = useCallback(() => {
    emit('editor:create_table', { rowsCount, columnsCount })
    setOpen(false)
  }, [columnsCount, rowsCount])

  const handleClose = useCallback(() => setOpen(false), [])

  const handleRowsInput = (e: any) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value)) {
      setRowsCount(value)
    } else {
      setRowsCount(0)
    }
  }

  const handleColsInput = (e: any) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value)) {
      setColumnsCount(value)
    } else {
      setColumnsCount(0)
    }
  }

  return (
    <MfDialog
      open={open}
      onClose={handleClose}
      title='Insert Table'
      dialogContentProps={{
        style: { width: 450, paddingTop: 20 },
      }}
      actions={[
        <Button key='cancel' size='small' onClick={handleClose}>
          Cancel
        </Button>,
        <Button key='ok' size='small' onClick={handleOk}>
          Ok
        </Button>,
      ]}
    >
      <Grid
        container
        spacing={2}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}
      >
        <Grid>
          <TextField
            size='small'
            label='col'
            value={rowsCount}
            onInput={handleRowsInput}
            InputLabelProps={{ shrink: true }}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
        </Grid>
        <Grid>
          <TextField
            size='small'
            value={columnsCount}
            onInput={handleColsInput}
            label='row'
            InputLabelProps={{ shrink: true }}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
        </Grid>
      </Grid>
    </MfDialog>
  )
}

export default TableDialog
