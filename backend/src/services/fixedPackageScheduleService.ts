import moment from 'moment'
import fixedPackageScheduleRepository from '~/repository/fixedPackageScheduleRepository'
import bookingRepository from '~/repository/bookingRepository'
import centerRepository from '~/repository/centerRepository'
import priceRepository from '~/repository/priceRepository'
import { PRICE_BY_MONTH } from '~/config/constant'

interface IFixedPackageScheduleService {
  addFixedPackageSchedule(userId: string, fixedPackageSchedule: any): Promise<any>
  getFixedPackageScheduleById(id: any): Promise<any | null>
  getFixedPackageSchedule(query: object): Promise<any | null>
}

class FixedPackageScheduleService implements IFixedPackageScheduleService {
  async addFixedPackageSchedule(userId: string, fixedPackageSchedule: any) {
    const { centerId, courtId, startDate, totalMonths, days } = fixedPackageSchedule
    const fixedPackageScheduleRepositoryInstance = new fixedPackageScheduleRepository()
    const centerRepositoryInstance = new centerRepository()
    const priceRepositoryInstance = new priceRepository()

    try {
      const center = await centerRepositoryInstance.getCenter({ _id: centerId })
      if (!center) {
        throw new Error(`Center with id ${centerId} not found`)
      }
      const price = await priceRepositoryInstance.getPriceByCenterIdAndScheduleType(centerId, PRICE_BY_MONTH)
      if (!price) {
        throw new Error(
          `Price for center with id ${centerId} and schedule type ${fixedPackageSchedule.scheduleType} not found`
        )
      }

      const bookings = []
      let totalPrice = 0
      const allPlayDates = [] // Khai báo mảng để chứa tất cả playDates

      for (const day of days) {
        const { dayOfWeek, startTime, duration } = day
        const endTime = moment(startTime, 'HH:mm').add(duration, 'hours').format('HH:mm')

        const dayPlayDates = this.generatePlayDates(startDate, totalMonths, dayOfWeek)
        allPlayDates.push(...dayPlayDates) // Thêm các playDates của ngày hiện tại vào mảng chung

        for (const playDate of dayPlayDates) {
          const booking = await bookingRepository.createBooking({
            centerId,
            courtId,
            userId: userId,
            date: playDate,
            start: startTime,
            end: endTime,
            status: 'pending',
            bookingType: 'byMonth',
            price: price.price * duration
          })
          bookings.push(booking._id)
          totalPrice += price.price * duration
        }
      }

      const fixedPackageScheduleData = {
        ...fixedPackageSchedule,
        bookings,
        totalPrice,
        endDate: moment(startDate).add(totalMonths, 'months').toDate(),
        playDates: allPlayDates,
        userId: userId
      }

      return fixedPackageScheduleRepositoryInstance.addFixedPackageSchedule(fixedPackageScheduleData)
    } catch (error) {
      throw new Error(`Error adding fixed package schedule: ${error}`)
    }
  }

  generatePlayDates(startDate: string, totalMonths: number, dayOfWeek: string) {
    const start = moment(startDate)
    const end = start.clone().add(totalMonths, 'months')

    const playDates = []
    let current = start.clone().day(dayOfWeek)

    if (current.isBefore(start)) {
      current = current.add(1, 'week')
    }

    while (current.isBefore(end)) {
      playDates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'week')
    }

    return playDates
  }

  async getFixedPackageScheduleById(id: any) {
    const fixedPackageScheduleRepositoryInstance = new fixedPackageScheduleRepository()
    return fixedPackageScheduleRepositoryInstance.getFixedPackageScheduleById(id)
  }

  async getFixedPackageSchedule(query: object) {
    const fixedPackageScheduleRepositoryInstance = new fixedPackageScheduleRepository()
    return fixedPackageScheduleRepositoryInstance.getFixedPackageSchedule(query)
  }
}

export default FixedPackageScheduleService
