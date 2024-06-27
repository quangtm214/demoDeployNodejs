import centerPackageRepository from '~/repository/centerPackageRepository'
import centerRepository from '~/repository/centerRepository'
import courtRepository from '~/repository/courtRepository'
import priceRepository from '~/repository/priceRepository'
import timeSlotRepository from '~/repository/timeslotRepository'
import AppError from '~/utils/appError'

interface ICenterService {
  addCenter(data: any): Promise<any>
  getAllCenters(): Promise<any>
  getCenterById(id: string): Promise<any>
  getPersonalCenters(userId: string): Promise<any>
  getPersonalCenterById(centerId: string, userId: string): Promise<any>
  selectPackage(centerId: string, packageId: string, userId: string): Promise<any>
  changeCenterStatusAccept(centerId: string): Promise<any>
  getPersonalActiveCenters(userId: string): Promise<any>
  updateCenterInforById(id: string, data: any, userId: string): Promise<any>
  getAllSubscriptions(): Promise<any>
  changeCenterStatus(centerId: string, status: string): Promise<any>

}

class centerService implements ICenterService {
  async addCenter(data: any) {
    const center = { ...data.center, managerId: data.user }
    const centerRepositoryInstance = new centerRepository()
    const newcenter = await centerRepositoryInstance.addCenter(center)
    const priceArray = data.price
    const priceRepositoryInstance = new priceRepository()
    const promises = priceArray.map(async (price: any) => {
      price.centerId = newcenter._id
      return priceRepositoryInstance.addPrice(price)
    })
    const newPrices = await Promise.all(promises)
    const priceIds = newPrices.map((price) => price._id)
    newcenter.price = priceIds
    await centerRepositoryInstance.updateCenter(newcenter._id, newcenter)
    //Tạo court ngay khi tạo Center
    const newCourts = []
    for (let i = 0; i < newcenter.courtCount; i++) {
      const court = {
        courtNumber: i + 1,
        centerId: newcenter._id
      }
      const courtRepositoryInstance = new courtRepository()
      const newCourt = await courtRepositoryInstance.addCourt(court)
      newCourts.push(newCourt)
    }
    return { newcenter, newPrices, newCourts }
  }

  async getAllCenters() {
    try {
      const centerRepositoryInstance = new centerRepository()
      const centers = await centerRepositoryInstance.getAllCenters()
      return centers
    } catch (error) {
      throw new Error(`Could not fetch all centers: ${(error as Error).message}`)
    }
  }

  async getCenterById(id: string) {
    try {
      const centerRepositoryInstance = new centerRepository()
      const center = await centerRepositoryInstance.getCenter({ _id: id })
      if (!center) {
        throw new Error(`Center with id ${id} not found`)
      }
      return center
    } catch (error) {
      throw new Error(`Could not fetch center: ${(error as Error).message}`)
    }
  }

  async getPersonalCenters(userId: string) {
    const centerRepositoryInstance = new centerRepository()
    const ListCenter = await centerRepositoryInstance.getListCenter({ managerId: userId })
    // const ListCenterWithPrices = await Promise.all(
    //   ListCenter.map(async (center: any) => {
    //     const prices = await priceRepository.getPricesByCenterId(center._id)
    //     return { ...center._doc, prices }
    //   })
    // )
    return ListCenter
  }

  async getPersonalCenterById(centerId: string, userId: string) {
    const centerRepositoryInstance = new centerRepository()

    const center: any = await centerRepositoryInstance.getCenter({ _id: centerId, managerId: userId })
    console.log(center)
    const priceRepositoryInstance = new priceRepository()
    const prices = await priceRepositoryInstance.getPrices({ centerId: center._id })
    return { center, prices }
  }

  async selectPackage(centerId: string, packageid: string, userId: string) {
    const centerRepositoryInstance = new centerRepository()
    const center = await centerRepositoryInstance.getCenter({ _id: centerId, managerId: userId })
    if (!center) {
      throw new AppError('Can not found center', 404)
    }
    if (center.status.includes('pending')) {
      throw new AppError('Can not set Package now', 409)
    }
    const centerPackageRepositoryInstance = new centerPackageRepository()
    const centerPackage = await centerPackageRepositoryInstance.getCenterPackage({ _id: packageid })
    if (!centerPackage) {
      throw new AppError('Can not found centerPackage', 404)
    }
    let latestSubscription
    if (center.subscriptions.length > 0) {
      latestSubscription = center.subscriptions.reduce((latest, subscription) => {
        return latest.expiryDate > subscription.expiryDate ? latest : subscription
      })
    }
    let activationDate = new Date()
    activationDate.setUTCHours(0, 0, 0, 0)
    if (latestSubscription && latestSubscription.expiryDate > activationDate) {
      const newDate = new Date(latestSubscription.expiryDate.getTime()) //lấy ngày kết thúc gần nhất
      newDate.setDate(newDate.getDate() + 1) //cộng thêm 1 ngày
      activationDate = newDate
    }
    const expiryDate = new Date(activationDate)
    expiryDate.setMonth(activationDate.getMonth() + centerPackage.durationMonths)
    const subscription = {
      packageId: packageid,
      activationDate: activationDate,
      expiryDate: expiryDate
    }
    center.subscriptions.push(subscription)
    if (center.status.includes('accepted') || center.status.includes('expired')) {
      center.status = 'active'
    }
    const modifeCenter = await centerRepositoryInstance.updateCenter({ _id: centerId }, center)
    const courtRepositoryInstance = new courtRepository()
    const listCourt = await courtRepositoryInstance.getListCourt({ centerId })
    const slotsAray: { start: string; end: string }[] = []
    const slot = {
      start: center.openTime,
      end: center.openTime
    }
    while (new Date(`1970-01-01T${slot.end}:00`) < new Date(`1970-01-01T${center.closeTime}:00`)) {
      const [hour, minute] = slot.start.split(':')
      if (minute === '00') {
        slot.end = `${hour}:30`
      }
      if (minute === '30') {
        slot.end = `${(parseInt(hour) + 1).toString().padStart(2, '0')}:00`
      }
      slotsAray.push({ ...slot })
      slot.start = slot.end
    }
    const ListTimeslot: { courtId: string; date: Date; slot: { start: string; end: string }[] }[] = []
    listCourt.forEach(async (court: any) => {
      const startDay = new Date(activationDate.getTime())
      while (startDay <= expiryDate) {
        const newTimeSlot = {
          courtId: court._id,
          date: new Date(startDay.getTime()),
          slot: slotsAray
        }
        ListTimeslot.push(newTimeSlot)
        startDay.setDate(startDay.getDate() + 1)
      }
    })
    const timeSlotRepositoryInstance = new timeSlotRepository()
    await timeSlotRepositoryInstance.addManyTimeSlots(ListTimeslot)
    return modifeCenter
  }

  async changeCenterStatusAccept(centerId: string) {
    const centerRepositoryInstance = new centerRepository()

    const center = await centerRepositoryInstance.getCenter({ _id: centerId })
    if (!center) {
      throw new AppError('Can not found center', 404)
    }
    center.status = 'accepted'
    return centerRepositoryInstance.updateCenter({ _id: centerId }, center)
  }
  async getPersonalActiveCenters(userId: string) {
    const centerRepositoryInstance = new centerRepository()
    const ListCenter = await centerRepositoryInstance.getListCenter({ managerId: userId, status: 'active' })
    return ListCenter
  }
  async updateCenterInforById(centerId: string, data: any, userId: string) {
    const centerRepositoryInstance = new centerRepository()
    const center = await centerRepositoryInstance.getCenter({ _id: centerId, managerId: userId })

    if (center && center.status.includes('active')) {
      throw new AppError('Can not update center infor when center is active', 409)
    }

    const listPriceId: any[] = []
    if (data.price) {
      const PriceList = data.price
      const priceRepositoryInstance = new priceRepository()
      const promises = PriceList.map(async (price: any) => {
        const existingPrice = await priceRepositoryInstance.getPrice({
          centerId: centerId,
          scheduleType: price.scheduleType
        })

        let updatePrice
        if (existingPrice) {
          // Nếu tồn tại, cập nhật giá trị
          updatePrice = await priceRepositoryInstance.updatePrice(
            { centerId: centerId, scheduleType: price.scheduleType },
            price
          )
        } else {
          // Nếu không tồn tại, tạo mới
          price = { ...price, centerId: centerId }
          updatePrice = await priceRepositoryInstance.addPrice(price)
        }
        console.log('updatePrice', updatePrice)
        if (updatePrice) {
          listPriceId.push(updatePrice._id)
        }
        return updatePrice
      })
      await Promise.all(promises)
    }

    if (!center) {
      throw new AppError(`Center not found`, 404)
    }

    const oldcourtCount = center.courtCount

    // Set the status to 'pending' before updating
    data.status = 'pending'
    console.log('listPriceId', listPriceId)
    if (listPriceId.length > 0) {
      data.price = listPriceId
    } else {
      delete data.price // Xóa trường price nếu không có giá trị mới
    }
    console.log('data999', data)

    Object.assign(center, data)
    console.log('center999', center)

    const updatedCenter = await centerRepositoryInstance.updateCenterInforById({ _id: centerId }, center)

    if (!updatedCenter) {
      throw new Error('Updated center is null')
    }

    // Add new courts
    const newCourts = []

    for (let i = oldcourtCount; i < updatedCenter.courtCount; i++) {
      console.log('iiiiii', i)
      const court = {
        courtNumber: i + 1,
        centerId: updatedCenter._id
      }
      const courtRepositoryInstance = new courtRepository()
      const newCourt = await courtRepositoryInstance.addCourt(court)
      newCourts.push(newCourt)
    }

    return { updatedCenter, newCourts }
  }

  async getAllSubscriptions() {
    try {
      const centerRepositoryInstance = new centerRepository()
      const centers = await centerRepositoryInstance.getAllSubscriptions()
      return centers
    } catch (error) {
      throw new Error(`Could not fetch all centers: ${(error as Error).message}`)
    }
  }
  
  async changeCenterStatus(centerId: string, status: 'pending' | 'accepted' | 'active' | 'expired' | 'rejected') {
    const centerRepositoryInstance = new centerRepository()
    const center = await centerRepositoryInstance.getCenter({ _id: centerId })

    if (!center) {
      throw new AppError('Center not found', 404)
    }

    center.status = status
    const updatedCenter = await centerRepositoryInstance.updateCenter({ _id: centerId }, center)
    return updatedCenter
  }
}
export default centerService
