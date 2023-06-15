import settingMap from '@/helper/cacheManager/settingMap'
import classNames from 'classnames'
import * as React from 'react'
import { memo } from 'react'
import SettingGroup from '../../components/Setting/SettingGroup'
import { Container } from './styles'

export interface DialogTitleProps {
  children?: React.ReactNode
  onClose: () => void
}

function a11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  }
}

function Setting() {
  const [value, setValue] = React.useState(0)
  const settingDataGroups = Object.keys(settingMap)
  const curGroupKey = settingDataGroups[value] as keyof typeof settingMap
  const curGroup = settingMap[curGroupKey] as Setting.SettingData
  const curGroupKeys = Object.keys(curGroup)

  return (
    <Container>
      <div id="sidebar">
        <div className="title">
        </div>
        {/* TODO search */}
        {/* <div id="search-form" role="search">
          <input id="q" aria-label="Search contacts" placeholder="Search" type="search" name="q" />
        </div> */}
        <nav>
          <ul>
            {settingDataGroups.map((group, index) => {
              return (
                <li
                  key={group}
                  className={classNames({
                    active: index === value,
                  })}
                  {...a11yProps(index)}
                  onClick={() => {
                    setValue(index)
                  }}
                >
                  {group}
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
      <div id="detail">
        {curGroupKeys.map((key) => {
          return <SettingGroup key={key} group={curGroup[key]} groupKey={key} categoryKey={curGroupKey} />
        })}
      </div>
      {/* <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: 224 }}>
      <Tabs orientation="vertical" variant="scrollable" value={value} onChange={handleChange} aria-label="Vertical tabs example" sx={{ borderRight: 1, borderColor: 'divider' }}>
        {settingDataGroups.map((group, index) => {
          return <Tab label="General" {...a11yProps(index)} />
        })}
      </Tabs>
      <TabPanel value={value} index={0}>
        {curGroupKeys.map((key) => {
          return <SettingGroup group={curGroup[key]} groupKey={key} categoryKey={curGroupKey} />
        })}
      </TabPanel>
    </Box> */}
    </Container>
  )
}

export default memo(Setting)

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}
