export type CloudSource =
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'icloud'
  | 'usb_drive'
  | 'folder_path'
  | 'local_device'

export const CLOUD_SOURCE_LABELS: Record<CloudSource, string> = {
  google_drive: 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  icloud: 'iCloud Drive',
  usb_drive: 'USB Drive',
  folder_path: 'Folder Path',
  local_device: 'Local Device',
}
