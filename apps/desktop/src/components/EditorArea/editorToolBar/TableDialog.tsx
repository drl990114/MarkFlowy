import { Dialog } from '@markflowy/components'
import bus from '@/helper/eventBus'
import { Button, TextField, Grid } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

function TableDialog() {
  const [open, setOpen] = useState(false)
  const [rowsCount, setRowsCount] = useState(4)
  const [columnsCount, setColumnsCount] = useState(4)

  useEffect(() => {
    const handler = () => {
      setOpen(true)
    }

    bus.on('editor:dialog_create_table', handler)

    return () => {
      bus.detach('editor:dialog_create_table', handler)
    }
  }, [])

  const handleOk = useCallback(() => {
    bus.emit('editor:create_table', { rowsCount, columnsCount })
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
    <Dialog
      open={open}
      onClose={handleClose}
      title='Insert Table'
      footer={[
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
        style={{
          paddingTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
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
    </Dialog>
  )
}

export default TableDialog
