import { useGlobalKeyboard } from '@/hooks'
import { KeyboardInfo } from '@/hooks/useKeyboard'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Button } from 'zens'
import { RecordKeysModal, RecordKeysModalRef } from './RecordKeysModal'
import { transferKey } from './record-key'

// Styled components
const TableContainer = styled.div`
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: 8px;
  overflow: hidden;
  background-color: ${(props) => props.theme.bgColor};
  margin-bottom: 16px;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${(props) => props.theme.fontSm};
`

const TableHead = styled.thead`
  background-color: ${(props) => props.theme.tipsBgColor};
`

const TableRow = styled.tr`
  border-bottom: 1px solid ${(props) => props.theme.borderColor};

  &:hover {
    background-color: ${(props) => props.theme.tipsBgColor};
  }
`

const TableCell = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
`

const TableDataCell = styled.td`
  padding: 12px 16px;
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
                  <Button size='small' onClick={() => handleOpen(row)}>
                    Edit
                  </Button>
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
