import { useEffect, useState } from 'react'

const VEHICLES_KEY = 'vehicles'
const RECORDS_KEY = 'fuelRecords'
const DEFAULT_VEHICLE = {
  name: 'Motor Utama',
  type: 'motorcycle',
}

function createId() {
  return Date.now() + Math.random()
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    const parsedValue = value ? JSON.parse(value) : fallback

    return Array.isArray(parsedValue) ? parsedValue : fallback
  } catch {
    return fallback
  }
}

function migrateLegacyRecords() {
  const storedVehicles = readJson(VEHICLES_KEY, [])
  const storedRecords = readJson(RECORDS_KEY, [])
  const legacyRecords = storedRecords.filter((record) => !record.vehicleId)

  if (legacyRecords.length === 0) {
    return storedVehicles
  }

  const defaultVehicle = {
    ...DEFAULT_VEHICLE,
    id: createId(),
  }
  const vehicles = [...storedVehicles, defaultVehicle]
  const migratedRecords = storedRecords.map((record) =>
    record.vehicleId ? record : { ...record, vehicleId: defaultVehicle.id },
  )

  window.localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles))
  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(migratedRecords))

  return vehicles
}

export function useVehicles() {
  const [vehicles, setVehicles] = useState(migrateLegacyRecords)

  useEffect(() => {
    window.localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles))
  }, [vehicles])

  function addVehicle(vehicle) {
    const newVehicle = { ...vehicle, id: createId() }
    setVehicles((currentVehicles) => [...currentVehicles, newVehicle])

    return newVehicle
  }

  function updateVehicle(vehicleId, updates) {
    setVehicles((currentVehicles) =>
      currentVehicles.map((vehicle) =>
        vehicle.id === vehicleId ? { ...vehicle, ...updates } : vehicle,
      ),
    )
  }

  function removeVehicle(vehicleId) {
    setVehicles((currentVehicles) =>
      currentVehicles.filter((vehicle) => vehicle.id !== vehicleId),
    )
  }

  return { vehicles, addVehicle, updateVehicle, removeVehicle }
}