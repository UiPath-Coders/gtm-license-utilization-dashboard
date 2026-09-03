import React from 'react'
import { Header } from '@/dashboard/chrome/Header'
import { CustomerLicenseUtilization } from './widgets/CustomerLicenseUtilization'

export function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 md:py-10">
        <Header title="Snowflake License Utilization Dashboard" description="Customer-level license capacity and utilization from UiPath Data Fabric." />

          {/* Tables */}
          <div className="space-y-6 mt-10">
            <CustomerLicenseUtilization />
          </div>
      </div>
    </div>
  )
}
