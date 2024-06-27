// userController.ts
import UserService from '~/services/userService'
import AppError from '~/utils/appError'
import catchAsync from '~/utils/catchAsync'

class UserController {
  static getPersonal = catchAsync(async (req: any, res: any, next: any) => {
    const userId = req.user.id
    const personal = await UserService.getUserById(userId)
    if (!personal) {
      throw new AppError('khong tim thay user', 401)
    }
    res.status(200).json({
      status: 'success',
      data: {
        personal
      }
    })
  })
  static updateUser = catchAsync(async (req: any, res: any, next: any) => {
    const userId = req.user.id
    const { userName, avatar, userPhone } = req.body

    const { newuser } = await UserService.updateUser(userId, { userName, avatar, userPhone })

    res.status(201).json({
      status: 'success',
      data: {
        user: newuser
        // token: token,
      }
    })
  })
  static getAllUser = catchAsync(async (req: any, res: any, next: any) => {
    try {
      const users = await UserService.getAllUser()
      res.status(200).json(users)
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error })
    }
  })
}

export default UserController
