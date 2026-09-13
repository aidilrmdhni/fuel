import { useEffect, useState } from 'react'

const STORAGE_KEY = 'fuelRecords'

function readStoredRecords() {
  try {
    const storedRecords = window.localStorage.getItem(STORAGE_KEY)
    const parsedRecords = storedRecords ? JSON.parse(storedRecords) : []

    return Array.isArray(parsedRecords) ? parsedRecords : []
  } catch {
    return []
  }
}

function createRecordId() {
  return Date.now() + Math.random()
}

export function useFuelRecords() {
  const [records, setRecords] = useState(readStoredRecords)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }, [records])

  function addRecord(record) {
    setRecords((currentRecords) => [
      ...currentRecords,
      { ...record, id: createRecordId() },
    ])
  }

  function removeRecord(recordId) {
    setRecords((currentRecords) =>
      currentRecords.filter((record) => record.id !== recordId),
    )
  }

  function removeRecordsForVehicle(vehicleId) {
    setRecords((currentRecords) =>
      currentRecords.filter((record) => record.vehicleId !== vehicleId),
    )
  }

  function replaceRecords(nextRecords) {
    setRecords(nextRecords)
  }

  function mergeRecords(nextRecords) {
    setRecords((currentRecords) => {
      const currentIds = new Set(currentRecords.map((record) => record.id))
      const importedRecords = nextRecords.map((record) => ({
        ...record,
        id: currentIds.has(record.id) ? createRecordId() : record.id,
      }))

      return [...currentRecords, ...importedRecords]
    })
  }

  return {
    records,
    addRecord,
    removeRecord,
    removeRecordsForVehicle,
    replaceRecords,
    mergeRecords,
  }
}