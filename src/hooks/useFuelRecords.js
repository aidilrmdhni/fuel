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

  return { records, addRecord, removeRecord }
}