// userService.ts
import userRepository from '~/repository/userRepository'
import AppError from '~/utils/appError'
import jwt from 'jsonwebtoken'
class UserService {
  static async updateUser(userId: string, infor: object) {
    const userRepositoryInstance = new userRepository()
    const user = await userRepositoryInstance.findUser({ _id: userId })
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 401)
    }

    const updatedUser = await userRepositoryInstance.updateUser(userId, infor)

    if (!updatedUser) {
      throw new AppError('Lỗi khi cập nhật thông tin người dùng', 401)
    }
    const { password: userPassword, ...newuser } = updatedUser.toObject()
    return { newuser }
  }
  static async getUserById(userId: string) {
    const userRepositoryInstance = new userRepository()
    const foundUser = await userRepositoryInstance.findUser({ _id: userId })
    if (!foundUser) {
      return null
    }
    const { password: userPassword, ...user } = foundUser.toObject()
    return user
  }
  static async getAllUser() {
    const userRepositoryInstance = new userRepository()
    return await userRepositoryInstance.getAllUser()
  }
}

export default UserService
