import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFuelRecords } from './hooks/useFuelRecords'
import { useVehicles } from './hooks/useVehicles'
import './App.css'

const VEHICLE_TYPES = {
  motorcycle: 'Motor',
  car: 'Mobil',
  other: 'Lainnya',
}

function getToday() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60000

  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function formatCurrency(value, fractionDigits = 0) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00`))
}

function getRecentMonths(count) {
  const today = new Date()

  return Array.from({ length: count }, (_, index) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1)
    const month = String(monthDate.getMonth() + 1).padStart(2, '0')

    return {
      key: `${monthDate.getFullYear()}-${month}`,
      label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(monthDate),
    }
  })
}

function getBackupFileName() {
  return `fuel-tracker-backup-${getToday()}.json`
}

function getCsvFileName(vehicleName) {
  const safeName = vehicleName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')

  return `riwayat-bensin-${safeName || 'kendaraan'}-${getToday()}.csv`
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '')

  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue
}

function isValidBackup(data) {
  const validTypes = new Set(['motorcycle', 'car', 'other'])
  const validVehicles = Array.isArray(data?.vehicles) && data.vehicles.every(
    (vehicle) => vehicle && vehicle.id !== undefined && typeof vehicle.name === 'string' &&
      validTypes.has(vehicle.type),
  )
  const validRecords = Array.isArray(data?.fuelRecords) && data.fuelRecords.every(
    (record) => record && record.id !== undefined && typeof record.vehicleId !== 'undefined' &&
      typeof record.date === 'string' && Number.isFinite(record.amount) && record.amount > 0 &&
      Number.isFinite(record.liters) && record.liters > 0 &&
      Number.isFinite(record.odometer) && record.odometer > 0,
  )

  return validVehicles && validRecords
}

function shouldShowBackupReminder(recordCount) {
  const lastBackupAt = Number(window.localStorage.getItem('lastBackupAt'))
  const dismissedUntil = Number(window.localStorage.getItem('backupReminderDismissedUntil'))
  const fourteenDays = 14 * 24 * 60 * 60 * 1000
  const hasExpiredBackup = !lastBackupAt || Date.now() - lastBackupAt > fourteenDays

  return recordCount >= 5 && hasExpiredBackup && Date.now() >= dismissedUntil
}

function VehicleIcon({ type }) {
  if (type === 'motorcycle') {
    return <svg viewBox="0 0 64 40" aria-hidden="true"><circle cx="14" cy="29" r="8" /><circle cx="50" cy="29" r="8" /><path d="M14 29 24 13h11l6 16M29 13l-5-7h8l5 7M41 29h9M37 13h8l5 8" /></svg>
  }

  if (type === 'car') {
    return <svg viewBox="0 0 64 40" aria-hidden="true"><path d="m10 27 5-13h34l7 13v6H10zM19 14l5-8h16l6 8M18 33a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM48 33a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg>
  }

  return <svg viewBox="0 0 64 40" aria-hidden="true"><path d="M8 27h48M14 27V13h36v14M21 13V7h22v6M19 33a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM47 33a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg>
}

function App() {
  const {
    vehicles,
    addVehicle,
    updateVehicle,
    removeVehicle,
    replaceVehicles,
    mergeVehicles,
  } = useVehicles()
  const {
    records,
    addRecord,
    removeRecord,
    removeRecordsForVehicle,
    replaceRecords,
    mergeRecords,
  } = useFuelRecords()
  const [activeVehicleId, setActiveVehicleId] = useState(vehicles[0]?.id ?? null)
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    type: 'motorcycle',
    budgetBulanan: '',
    intervalServisKm: '',
  })
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [form, setForm] = useState({ date: getToday(), amount: '', liters: '', odometer: '' })
  const [error, setError] = useState('')
  const [dataMessage, setDataMessage] = useState({ type: '', text: '' })
  const [theme, setTheme] = useState(() => window.localStorage.getItem('themePreference') || 'dark')
  const [showBackupReminder, setShowBackupReminder] = useState(() => shouldShowBackupReminder(records.length))
  const selectedVehicleId = vehicles.some((vehicle) => vehicle.id === activeVehicleId)
    ? activeVehicleId
    : vehicles[0]?.id
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId)

  const activeRecords = records.filter((record) => record.vehicleId === selectedVehicleId)
  const chronologicalRecords = [...activeRecords].sort((firstRecord, secondRecord) =>
    firstRecord.date.localeCompare(secondRecord.date) || firstRecord.id - secondRecord.id,
  )
  const calculations = new Map(chronologicalRecords.map((record, index) => {
    const previousRecord = chronologicalRecords[index - 1]
    if (!previousRecord) return [record.id, null]
    const distance = record.odometer - previousRecord.odometer
    return [record.id, distance > 0 ? {
      distance,
      efficiency: distance / record.liters,
      costPerKm: record.amount / distance,
    } : null]
  }))
  const displayedRecords = [...activeRecords].sort((firstRecord, secondRecord) =>
    secondRecord.date.localeCompare(firstRecord.date) || secondRecord.id - firstRecord.id,
  )
  const currentMonth = getToday().slice(0, 7)
  const currentMonthRecords = activeRecords.filter((record) => record.date.startsWith(currentMonth))
  const monthlyEfficiencies = currentMonthRecords
    .map((record) => calculations.get(record.id)?.efficiency)
    .filter((efficiency) => Number.isFinite(efficiency))
  const monthlySummary = {
    totalAmount: currentMonthRecords.reduce((total, record) => total + record.amount, 0),
    totalLiters: currentMonthRecords.reduce((total, record) => total + record.liters, 0),
    averageAmount: currentMonthRecords.length ? currentMonthRecords.reduce((total, record) => total + record.amount, 0) / currentMonthRecords.length : 0,
    averageEfficiency: monthlyEfficiencies.length ? monthlyEfficiencies.reduce((total, efficiency) => total + efficiency, 0) / monthlyEfficiencies.length : 0,
  }
  const comparisonStats = vehicles
    .map((vehicle) => {
      const vehicleRecords = records
        .filter((record) => record.vehicleId === vehicle.id)
        .sort((firstRecord, secondRecord) =>
          firstRecord.date.localeCompare(secondRecord.date) || firstRecord.id - secondRecord.id,
        )
      const vehicleCalculations = vehicleRecords.slice(1).map((record, index) => {
        const previousRecord = vehicleRecords[index]
        const distance = record.odometer - previousRecord.odometer

        return distance > 0
          ? { distance, efficiency: distance / record.liters }
          : null
      }).filter(Boolean)
      const vehicleMonthRecords = vehicleRecords.filter((record) => record.date.startsWith(currentMonth))

      return {
        vehicle,
        totalAmount: vehicleMonthRecords.reduce((total, record) => total + record.amount, 0),
        averageEfficiency: vehicleCalculations.length
          ? vehicleCalculations.reduce((total, calculation) => total + calculation.efficiency, 0) / vehicleCalculations.length
          : null,
        totalDistance: vehicleCalculations.reduce((total, calculation) => total + calculation.distance, 0),
      }
    })
    .sort((firstStats, secondStats) => (secondStats.averageEfficiency ?? -1) - (firstStats.averageEfficiency ?? -1))
  const bestEfficiency = comparisonStats.find((stats) => stats.averageEfficiency !== null)?.averageEfficiency
  const monthlyBudget = Number(activeVehicle?.budgetBulanan) || 0
  const serviceInterval = Number(activeVehicle?.intervalServisKm) || 0
  const latestRecord = chronologicalRecords[chronologicalRecords.length - 1]
  const firstRecord = chronologicalRecords[0]
  const distanceSinceService = latestRecord && firstRecord
    ? Math.max(0, latestRecord.odometer - firstRecord.odometer)
    : 0
  const serviceRemaining = serviceInterval - distanceSinceService
  const budgetPercentage = monthlyBudget
    ? Math.min(100, (monthlySummary.totalAmount / monthlyBudget) * 100)
    : 0
  const budgetStatus = budgetPercentage >= 100
    ? 'over'
    : budgetPercentage >= 75
      ? 'warning'
      : 'good'

  useEffect(() => {
    window.localStorage.setItem('themePreference', theme)
  }, [theme])
  const monthlyChartData = getRecentMonths(6).map((month) => ({
    ...month,
    amount: activeRecords
      .filter((record) => record.date.startsWith(month.key))
      .reduce((total, record) => total + record.amount, 0),
  }))
  const spendingPoints = monthlyChartData.filter((month) => month.amount > 0).length
  const efficiencyChartData = chronologicalRecords
    .map((record) => {
      const calculation = calculations.get(record.id)

      return calculation
        ? { label: formatDate(record.date), efficiency: calculation.efficiency }
        : null
    })
    .filter(Boolean)

  function handleVehicleChange(event) {
    const { name, value } = event.target
    setVehicleForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  function handleVehicleSubmit(event) {
    event.preventDefault()
    const name = vehicleForm.name.trim()
    if (!name) return
    if (editingVehicleId) {
      updateVehicle(editingVehicleId, {
        name,
        type: vehicleForm.type,
        budgetBulanan: vehicleForm.budgetBulanan ? Number(vehicleForm.budgetBulanan) : null,
        intervalServisKm: vehicleForm.intervalServisKm ? Number(vehicleForm.intervalServisKm) : null,
      })
    } else {
      const newVehicle = addVehicle({
        name,
        type: vehicleForm.type,
        budgetBulanan: vehicleForm.budgetBulanan ? Number(vehicleForm.budgetBulanan) : null,
        intervalServisKm: vehicleForm.intervalServisKm ? Number(vehicleForm.intervalServisKm) : null,
      })
      setActiveVehicleId(newVehicle.id)
    }
    setVehicleForm({ name: '', type: 'motorcycle', budgetBulanan: '', intervalServisKm: '' })
    setEditingVehicleId(null)
  }

  function startEditingVehicle(vehicle) {
    setEditingVehicleId(vehicle.id)
    setVehicleForm({
      name: vehicle.name,
      type: vehicle.type,
      budgetBulanan: vehicle.budgetBulanan ?? '',
      intervalServisKm: vehicle.intervalServisKm ?? '',
    })
  }

  function handleRemoveVehicle(vehicle) {
    if (!window.confirm(`Hapus ${vehicle.name} beserta seluruh riwayatnya?`)) return
    removeRecordsForVehicle(vehicle.id)
    removeVehicle(vehicle.id)
  }

  function handleExport() {
    const backup = JSON.stringify({ vehicles, fuelRecords: records }, null, 2)
    const blob = new Blob([backup], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = downloadUrl
    link.download = getBackupFileName()
    link.click()
    URL.revokeObjectURL(downloadUrl)
    window.localStorage.setItem('lastBackupAt', String(Date.now()))
    window.localStorage.removeItem('backupReminderDismissedUntil')
    setShowBackupReminder(false)
    setDataMessage({ type: 'success', text: `Data berhasil diekspor sebagai ${link.download}.` })
  }

  function handleExportCsv() {
    if (!activeVehicle) return

    const headers = ['Tanggal', 'Nominal', 'Liter', 'Odometer', 'Jarak', 'Efisiensi km/L', 'Biaya per km']
    const rows = chronologicalRecords.map((record) => {
      const calculation = calculations.get(record.id)

      return [
        record.date,
        record.amount,
        record.liters,
        record.odometer,
        calculation?.distance ?? '-',
        calculation?.efficiency ?? '-',
        calculation?.costPerKm ?? '-',
      ]
    })
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = downloadUrl
    link.download = getCsvFileName(activeVehicle.name)
    link.click()
    URL.revokeObjectURL(downloadUrl)
    setDataMessage({ type: 'success', text: `Riwayat berhasil diekspor sebagai ${link.download}.` })
  }

  function dismissBackupReminder() {
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000

    window.localStorage.setItem('backupReminderDismissedUntil', String(tomorrow))
    setShowBackupReminder(false)
  }

  function handleImport(event) {
    const [file] = event.target.files
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result)
        if (!isValidBackup(backup)) throw new Error('Struktur backup tidak valid.')

        const mode = window.confirm(
          'Pilih OK untuk mengganti semua data, atau Cancel untuk menggabungkan dengan data yang ada.',
        )
        if (mode) {
          replaceVehicles(backup.vehicles)
          replaceRecords(backup.fuelRecords)
          setActiveVehicleId(backup.vehicles[0]?.id ?? null)
          setDataMessage({ type: 'success', text: 'Semua data berhasil diganti dari backup.' })
        } else {
          mergeVehicles(backup.vehicles)
          mergeRecords(backup.fuelRecords)
          setDataMessage({ type: 'success', text: 'Data backup berhasil digabungkan.' })
        }
      } catch (importError) {
        setDataMessage({ type: 'error', text: `Import gagal: ${importError.message}` })
      }
    }
    reader.onerror = () => setDataMessage({ type: 'error', text: 'Import gagal: file tidak dapat dibaca.' })
    reader.readAsText(file)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setError('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const numericValues = ['amount', 'liters', 'odometer'].map((field) => Number(form[field]))
    const hasEmptyField = Object.values(form).some((value) => value === '')
    const hasInvalidNumber = numericValues.some((value) => !Number.isFinite(value) || value <= 0)
    if (hasEmptyField || !form.date || hasInvalidNumber) {
      setError('Isi semua field dengan nilai angka yang lebih besar dari nol.')
      return
    }
    addRecord({ vehicleId: activeVehicleId, date: form.date, amount: numericValues[0], liters: numericValues[1], odometer: numericValues[2] })
    setForm({ date: getToday(), amount: '', liters: '', odometer: '' })
    setError('')
  }

  function handleRemove(record) {
    if (window.confirm(`Hapus catatan pengisian tanggal ${formatDate(record.date)}?`)) removeRecord(record.id)
  }

  return (
    <main className={`app theme-${theme}`}>
      <header className="page-header">
        <p className="eyebrow">Dashboard kendaraan</p>
        <h1>Motor Fuel Tracker</h1>
        <p className="subtitle">Satu tempat untuk memantau biaya dan efisiensi semua kendaraan.</p>
        <button className="theme-toggle" type="button" onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
        </button>
      </header>

      {showBackupReminder && <aside className="backup-reminder" role="status">
        <div>
          <strong>Waktunya mencadangkan data</strong>
          <p>Data kendaraan dan riwayat bensin sudah cukup banyak. Simpan backup JSON agar tetap aman.</p>
        </div>
        <div className="backup-reminder-actions">
          <button type="button" onClick={handleExport}>Export sekarang</button>
          <button className="reminder-dismiss" type="button" onClick={dismissBackupReminder}>Ingatkan besok</button>
        </div>
      </aside>}

      <section className="vehicles-section" aria-labelledby="vehicles-title">
        <div className="section-heading page-section-heading">
          <div><p className="eyebrow">Garasi</p><h2 id="vehicles-title">Kendaraan Saya</h2></div>
          {vehicles.length > 0 && <span>{vehicles.length} kendaraan</span>}
        </div>
        <div className="vehicle-manager">
          <div className="vehicle-cards">
            {vehicles.map((vehicle, index) => (
              <article className={`vehicle-card vehicle-color-${index % 4} ${vehicle.id === activeVehicleId ? 'is-active' : ''}`} key={vehicle.id}>
                <button className="vehicle-select" type="button" onClick={() => setActiveVehicleId(vehicle.id)} aria-pressed={vehicle.id === activeVehicleId}>
                  <span className="vehicle-icon"><VehicleIcon type={vehicle.type} /></span>
                  <span className="vehicle-details"><strong>{vehicle.name}</strong><small>{VEHICLE_TYPES[vehicle.type]}</small></span>
                </button>
                <div className="vehicle-actions"><button type="button" onClick={() => startEditingVehicle(vehicle)}>Edit</button><button type="button" onClick={() => handleRemoveVehicle(vehicle)}>Hapus</button></div>
              </article>
            ))}
            {vehicles.length === 0 && <div className="vehicle-empty"><span className="vehicle-empty-icon">+</span><strong>Belum ada kendaraan</strong><span>Tambahkan kendaraan pertama untuk mulai mencatat bensin.</span></div>}
          </div>
          <form className="vehicle-form" onSubmit={handleVehicleSubmit}>
            <h3>{editingVehicleId ? 'Edit kendaraan' : 'Tambah kendaraan'}</h3>
            <label>Nama kendaraan<input type="text" name="name" value={vehicleForm.name} onChange={handleVehicleChange} placeholder="Motor Vario" required /></label>
            <label>Jenis kendaraan<select name="type" value={vehicleForm.type} onChange={handleVehicleChange}><option value="motorcycle">Motor</option><option value="car">Mobil</option><option value="other">Lainnya</option></select></label>
            <label>Budget bulanan (opsional)<input type="number" name="budgetBulanan" min="0" step="1" value={vehicleForm.budgetBulanan} onChange={handleVehicleChange} placeholder="1000000" /></label>
            <label>Interval servis (km, opsional)<input type="number" name="intervalServisKm" min="0" step="1" value={vehicleForm.intervalServisKm} onChange={handleVehicleChange} placeholder="2000" /></label>
            <div className="vehicle-form-actions"><button type="submit">{editingVehicleId ? 'Simpan perubahan' : 'Tambah kendaraan'}</button>{editingVehicleId && <button className="secondary-button" type="button" onClick={() => { setEditingVehicleId(null); setVehicleForm({ name: '', type: 'motorcycle', budgetBulanan: '', intervalServisKm: '' }) }}>Batal</button>}</div>
          </form>
        </div>
        <div className="data-actions">
          <button type="button" onClick={handleExport}>Export Data</button>
          <button type="button" onClick={handleExportCsv} disabled={!activeVehicle}>Export ke CSV</button>
          <label className="import-button">
            Import Data
            <input type="file" accept="application/json,.json" onChange={handleImport} />
          </label>
        </div>
        {dataMessage.text && <p className={`data-message ${dataMessage.type}`} role="status">{dataMessage.text}</p>}
      </section>

      {!activeVehicle ? <div className="app-empty-state">Pilih atau tambahkan kendaraan di atas untuk melihat dashboard bensin.</div> : (
        <>
          <div className="active-vehicle-label">Menampilkan data untuk <strong>{activeVehicle.name}</strong></div>
          <section className="panel" aria-labelledby="form-title">
            <h2 id="form-title">Tambah pengisian</h2>
            <form className="fuel-form" onSubmit={handleSubmit}>
              <label>Tanggal<input type="date" name="date" value={form.date} onChange={handleChange} /></label>
              <label>Nominal bensin (rupiah)<input type="number" name="amount" min="0" step="1" value={form.amount} onChange={handleChange} placeholder="50000" /></label>
              <label>Liter bensin<input type="number" name="liters" min="0" step="any" value={form.liters} onChange={handleChange} placeholder="4.2" /></label>
              <label>Odometer saat ini (km)<input type="number" name="odometer" min="0" step="any" value={form.odometer} onChange={handleChange} placeholder="12500" /></label>
              <button type="submit">Simpan catatan</button>
            </form>
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>

          <section className="summary panel" aria-labelledby="summary-title">
            <div className="section-heading summary-heading"><div><h2 id="summary-title">Ringkasan {formatMonth(currentMonth)}</h2><p>Rekap khusus {activeVehicle.name}.</p></div></div>
            {currentMonthRecords.length === 0 ? <div className="empty-state">Belum ada pengisian bensin bulan ini.</div> : <div className="summary-grid"><div className="summary-item"><span>Total pengeluaran</span><strong>{formatCurrency(monthlySummary.totalAmount)}</strong></div><div className="summary-item"><span>Total liter</span><strong>{formatNumber(monthlySummary.totalLiters)} L</strong></div><div className="summary-item"><span>Rata-rata nominal / isi</span><strong>{formatCurrency(monthlySummary.averageAmount)}</strong></div><div className="summary-item"><span>Rata-rata efisiensi</span><strong>{monthlyEfficiencies.length ? `${formatNumber(monthlySummary.averageEfficiency)} km/L` : '-'}</strong></div></div>}
          </section>

          {(monthlyBudget > 0 || serviceInterval > 0) && <section className="reminders-grid" aria-label="Pengingat dan target">
            {monthlyBudget > 0 && <article className="reminder-card budget-card">
              <div className="reminder-heading"><h2>Budget Bulan Ini</h2><strong>{formatCurrency(monthlySummary.totalAmount)} / {formatCurrency(monthlyBudget)}</strong></div>
              <div className="progress-track" aria-label={`${formatNumber(budgetPercentage)} persen budget terpakai`}><span className={`progress-value ${budgetStatus}`} style={{ width: `${budgetPercentage}%` }} /></div>
              <p>{formatNumber(budgetPercentage)}% terpakai</p>
            </article>}
            {serviceInterval > 0 && latestRecord && <article className="reminder-card service-card">
              <div className="reminder-heading"><h2>Pengingat Servis</h2><strong>Setiap {formatNumber(serviceInterval)} km</strong></div>
              <p className={serviceRemaining <= 0 ? 'service-due' : ''}>{serviceRemaining <= 0 ? 'Saatnya servis!' : `${formatNumber(serviceRemaining)} km lagi menuju servis berikutnya`}</p>
              <small>Patokan awal: odometer saat catatan pertama ({formatNumber(firstRecord.odometer)} km).</small>
            </article>}
          </section>}

          <section className="charts-section" aria-labelledby="charts-title">
            <div className="section-heading chart-heading">
              <div><h2 id="charts-title">Grafik Tren</h2><p>Perubahan pengeluaran dan efisiensi kendaraan ini.</p></div>
            </div>
            <div className="charts-grid">
              <article className="chart-card">
                <h3>Pengeluaran per bulan</h3>
                {spendingPoints < 2 ? <div className="chart-empty">Data belum cukup untuk menampilkan grafik</div> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={monthlyChartData} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="amount" name="Pengeluaran" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </article>
              <article className="chart-card">
                <h3>Efisiensi per pengisian</h3>
                {efficiencyChartData.length < 2 ? <div className="chart-empty">Data belum cukup untuk menampilkan grafik</div> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={efficiencyChartData} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${value} km/L`} />
                      <Tooltip formatter={(value) => `${formatNumber(value)} km/L`} />
                      <Line type="monotone" dataKey="efficiency" name="Efisiensi" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </article>
            </div>
          </section>

          <section className="history" aria-labelledby="history-title">
            <div className="section-heading"><h2 id="history-title">Riwayat pengisian</h2><span>{activeRecords.length} catatan</span></div>
            {displayedRecords.length === 0 ? <div className="empty-state">Belum ada catatan pengisian untuk kendaraan ini.</div> : <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nominal</th><th>Liter</th><th>Odometer</th><th>Jarak</th><th>Efisiensi</th><th>Biaya/km</th><th><span className="visually-hidden">Aksi</span></th></tr></thead><tbody>{displayedRecords.map((record) => { const calculation = calculations.get(record.id); return <tr key={record.id}><td>{formatDate(record.date)}</td><td>{formatCurrency(record.amount)}</td><td>{formatNumber(record.liters)} L</td><td>{formatNumber(record.odometer)} km</td><td>{calculation ? `${formatNumber(calculation.distance)} km` : '-'}</td><td>{calculation ? `${formatNumber(calculation.efficiency)} km/L` : '-'}</td><td>{calculation ? formatCurrency(calculation.costPerKm, 2) : '-'}</td><td><button className="delete-button" type="button" onClick={() => handleRemove(record)}>Hapus</button></td></tr> })}</tbody></table></div>}
          </section>
        </>
      )}

      {vehicles.length >= 2 && <section className="comparison-section" aria-labelledby="comparison-title">
        <div className="section-heading comparison-heading">
          <div><p className="eyebrow">Overview garasi</p><h2 id="comparison-title">Perbandingan Kendaraan</h2></div>
          <span>{vehicles.length} kendaraan</span>
        </div>
        <div className="table-wrap"><table className="comparison-table"><thead><tr><th>Kendaraan</th><th>Pengeluaran bulan ini</th><th>Rata-rata efisiensi</th><th>Total km ditempuh</th></tr></thead><tbody>
          {comparisonStats.map((stats) => <tr key={stats.vehicle.id}><td><strong>{stats.vehicle.name}</strong>{stats.averageEfficiency === bestEfficiency && <span className="economy-badge">Paling Hemat</span>}</td><td>{formatCurrency(stats.totalAmount)}</td><td>{stats.averageEfficiency === null ? '-' : `${formatNumber(stats.averageEfficiency)} km/L`}</td><td>{formatNumber(stats.totalDistance)} km</td></tr>)}
        </tbody></table></div>
      </section>}
    </main>
  )
}

export default App