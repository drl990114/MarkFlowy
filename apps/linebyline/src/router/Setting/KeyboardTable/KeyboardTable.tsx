import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { useGlobalKeyboard, useGlobalTheme } from '@/hooks'

export function KeyboardTable() {
  const { themeColors } = useGlobalTheme()
  const { keyboardInfos } = useGlobalKeyboard()

  return (
    <TableContainer component={Paper}>
      <Table size='small' aria-label='caption table'>
        <TableHead
          sx={{
            backgroundColor: themeColors.tipsBgColor,
          }}
        >
          <TableRow>
            <TableCell>Command</TableCell>
            <TableCell>Descibe</TableCell>
            <TableCell>Keybinding</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keyboardInfos.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.desc}</TableCell>
              <TableCell>{row.key_map.join('+')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <caption>Currently, custom shortcut keys are not supported.</caption>
      </Table>
    </TableContainer>
  )
}
