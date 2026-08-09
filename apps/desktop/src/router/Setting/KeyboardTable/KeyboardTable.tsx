import { Button } from '@/components/ui/button'
import { useGlobalKeyboard } from '@/hooks'
import type { KeyboardInfo } from '@/hooks/useKeyboard'
import { useRef } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { Tooltip } from 'zens'
import { RecordKeysModal, type RecordKeysModalRef } from './RecordKeysModal'
import { transferKey } from './record-key'

const TableContainer = styled.div`
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  border-radius: var(--mf-radius);
  box-sizing: border-box;
  margin-bottom: 16px;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--mf-scrollbar-track);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--mf-scrollbar-thumb);
    border-radius: 4px;
  }
`

const Table = styled.table`
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: 12px;
`

const TableHead = styled.thead`
  background-color: var(--mf-muted);
`

const TableRow = styled.tr`
  border-bottom: 1px solid var(--mf-border);

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background-color: var(--mf-muted);
  }
`

const TableCell = styled.th`
  padding: 7px 10px;
  text-align: left;
  font-weight: 600;
`

const TableDataCell = styled.td`
  padding: 7px 10px;
  text-align: left;
`

export function KeyboardTable() {
  const { keyboardInfos } = useGlobalKeyboard()
  const recordKeysModalRef = useRef<RecordKeysModalRef>(null)
  const { t } = useTranslation()

  const handleOpen = (command: KeyboardInfo) => {
    recordKeysModalRef.current?.open(command)
  }

  return (
    <>
      <TableContainer>
        <Table aria-label='keyboard shortcuts table'>
          <TableHead>
            <TableRow>
              <TableCell>Command</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Keybinding</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <tbody>
            {keyboardInfos.map((row) => (
              <TableRow key={row.id}>
                <TableDataCell>{row.id}</TableDataCell>
                <TableDataCell>{t(`command.id_descriptions.${row.id}`)}</TableDataCell>
                <TableDataCell>{row.key_map.map((v) => transferKey(v)).join(' + ')}</TableDataCell>
                <TableDataCell>
                  {row.when === 'disabled' ? (
                    <Tooltip title='This shortcut is disabled and cannot be edited'>
                      <Button size='sm' disabled>
                        Edit
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button size='sm' onClick={() => handleOpen(row)}>
                      Edit
                    </Button>
                  )}
                </TableDataCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </TableContainer>

      <RecordKeysModal ref={recordKeysModalRef} />
    </>
  )
}
