class DataCenter {
  private data: DataCenterData = {
    markdownContent: '# Welcome linebyline',
  }

  setData = (key: DataCenterDataKeys, value: any) => {
    this.data[key] = value
  }

  getData = (key: DataCenterDataKeys) => {
    return this.data[key]
  }
}

export interface DataCenterData {
  markdownContent: string
}
type DataCenterDataKeys = keyof DataCenterData
const DataCenterInstance = new DataCenter()
export default DataCenterInstance
