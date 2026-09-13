import { useState } from 'react'
import { useFuelRecords } from './hooks/useFuelRecords'
import './App.css'

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
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))
}

function App() {
  const { records, addRecord, removeRecord } = useFuelRecords()
  const [form, setForm] = useState({
    date: getToday(),
    amount: '',
    liters: '',
    odometer: '',
  })
  const [error, setError] = useState('')

  const chronologicalRecords = [...records].sort(
    (firstRecord, secondRecord) =>
      firstRecord.date.localeCompare(secondRecord.date) ||
      firstRecord.id - secondRecord.id,
  )
  const calculations = new Map(
    chronologicalRecords.map((record, index) => {
      const previousRecord = chronologicalRecords[index - 1]

      if (!previousRecord) {
        return [record.id, null]
      }

      const distance = record.odometer - previousRecord.odometer

      return [
        record.id,
        distance > 0
          ? {
              distance,
              efficiency: distance / record.liters,
              costPerKm: record.amount / distance,
            }
          : null,
      ]
    }),
  )
  const displayedRecords = [...records].sort(
    (firstRecord, secondRecord) =>
      secondRecord.date.localeCompare(firstRecord.date) ||
      secondRecord.id - firstRecord.id,
  )

  function handleChange(event) {
    const { name, value } = event.target

    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setError('')
  }

  function handleSubmit(event) {
    event.preventDefault()

    const numericValues = ['amount', 'liters', 'odometer'].map((field) =>
      Number(form[field]),
    )
    const hasEmptyField = Object.values(form).some((value) => value === '')
    const hasInvalidNumber = numericValues.some(
      (value) => !Number.isFinite(value) || value <= 0,
    )

    if (hasEmptyField || !form.date || hasInvalidNumber) {
      setError('Isi semua field dengan nilai angka yang lebih besar dari nol.')
      return
    }

    addRecord({
      date: form.date,
      amount: numericValues[0],
      liters: numericValues[1],
      odometer: numericValues[2],
    })
    setForm({ date: getToday(), amount: '', liters: '', odometer: '' })
    setError('')
  }

  function handleRemove(record) {
    if (window.confirm(`Hapus catatan pengisian tanggal ${formatDate(record.date)}?`)) {
      removeRecord(record.id)
    }
  }

  return (
    <main className="app">
      <header className="page-header">
        <p className="eyebrow">Catatan kendaraan</p>
        <h1>Motor Fuel Tracker</h1>
        <p className="subtitle">Pantau biaya dan efisiensi pengisian bensin.</p>
      </header>

      <section className="panel" aria-labelledby="form-title">
        <h2 id="form-title">Tambah pengisian</h2>
        <form className="fuel-form" onSubmit={handleSubmit}>
          <label>
            Tanggal
            <input type="date" name="date" value={form.date} onChange={handleChange} />
          </label>
          <label>
            Nominal bensin (rupiah)
            <input
              type="number"
              name="amount"
              min="0"
              step="1"
              value={form.amount}
              onChange={handleChange}
              placeholder="50000"
            />
          </label>
          <label>
            Liter bensin
            <input
              type="number"
              name="liters"
              min="0"
              step="any"
              value={form.liters}
              onChange={handleChange}
              placeholder="4.2"
            />
          </label>
          <label>
            Odometer saat ini (km)
            <input
              type="number"
              name="odometer"
              min="0"
              step="any"
              value={form.odometer}
              onChange={handleChange}
              placeholder="12500"
            />
          </label>
          <button type="submit">Simpan catatan</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <section className="history" aria-labelledby="history-title">
        <div className="section-heading">
          <h2 id="history-title">Riwayat pengisian</h2>
          <span>{records.length} catatan</span>
        </div>
        {displayedRecords.length === 0 ? (
          <div className="empty-state">Belum ada catatan pengisian.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nominal</th>
                  <th>Liter</th>
                  <th>Odometer</th>
                  <th>Jarak</th>
                  <th>Efisiensi</th>
                  <th>Biaya/km</th>
                  <th><span className="visually-hidden">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {displayedRecords.map((record) => {
                  const calculation = calculations.get(record.id)

                  return (
                    <tr key={record.id}>
                      <td>{formatDate(record.date)}</td>
                      <td>{formatCurrency(record.amount)}</td>
                      <td>{formatNumber(record.liters)} L</td>
                      <td>{formatNumber(record.odometer)} km</td>
                      <td>{calculation ? `${formatNumber(calculation.distance)} km` : '-'}</td>
                      <td>{calculation ? `${formatNumber(calculation.efficiency)} km/L` : '-'}</td>
                      <td>{calculation ? formatCurrency(calculation.costPerKm, 2) : '-'}</td>
                      <td>
                        <button
                          className="delete-button"
                          type="button"
                          onClick={() => handleRemove(record)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
