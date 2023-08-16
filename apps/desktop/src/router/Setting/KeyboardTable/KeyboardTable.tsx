import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { useGlobalKeyboard, useGlobalTheme } from '@/hooks'
import useOSInfo from '@/hooks/useOSInfo'
import type { OsType } from '@tauri-apps/api/os'

function transferKey(key: string, osType?: OsType) {
  if (osType === 'Darwin') {
    return key.replace('CommandOrCtrl', '⌘')
  } else {
    return key.replace('CommandOrCtrl', 'Ctrl')
  }
  return key
}

export function KeyboardTable() {
  const { themeColors } = useGlobalTheme()
  const { keyboardInfos } = useGlobalKeyboard()
  const { osType } = useOSInfo()

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
              <TableCell>{row.key_map.map((v) => transferKey(v, osType)).join(' + ')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <caption>Customized shortcut keys will soon be supported.</caption>
      </Table>
    </TableContainer>
  )
}
