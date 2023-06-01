const User = require('../models/userModel')
const ErrorHander = require('../utils/errorhander')
const sendEmail = require('../utils/sendEmail')
const catchAsyncErrors = require('../middleware/catchAsyncErrors');
const sendToken = require('../utils/jwtToken');

// Register a user
exports.registerUser = catchAsyncErrors(async (req, res, next) => {
    const { name, email, password } = req.body;
    const user = await User.create({
        name, email, password,
        avatar: {
            public_id: "im fake id",
            url: "fakeurl"
        }
    })

    sendToken(user, 201, res);
})

// Login user
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
    const { email, password } = req.body;

    // check email & password
    if (!email || !password) {
        return next(new ErrorHander("please enter email & password both", 400))
    }

    // find user
    const user = await User.findOne({ email }).select('+password')

    if (!user) {
        return next(new ErrorHander("invalid email or password", 401))
    }

    // match password
    const isPasswordMatched = await user.comparePassword(password);

    if (!isPasswordMatched) {
        return next(new ErrorHander("invalid email or password", 401))
    }

    sendToken(user, 200, res);
})

// user logout
exports.logout = catchAsyncErrors(async (req, res, next) => {
    res.cookie('token', null, {
        expires: new Date(Date.now()),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: "Logged out"
    })

})

// forgot password
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email })
    if (!user) {
        return next(new ErrorHander("User not found", 404))
    }

    // get resetpassword token
    const resetToken = user.getResetPasswordToken()
    await user.save({ validateBeforeSave: false })

    const resetPasswordUrl = `${req.protocol}://${req.get('host')}/api/v1/password/rest/${resetToken}`

    const message = `password reset token is - \n\n ${resetPasswordUrl} \n\n ignore if not requested`

    try {
        await sendEmail({
            email: user.email,
            subject: 'ecommerce password recovery',
            message
        })
        res.status(200).json({
            success: true,
            message: `email sent to ${user.email} successfully`
        })
    } catch (error) {
        user.resetPasswordToken = undefined
        user.resetPasswordExpire = undefined
        await user.save({ validateBeforeSave: false })
        return next(new ErrorHander(error.message, 500))

    }
})

// reset password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({
        resetPasswordToken, resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
        return next(new ErrorHander("invalid or expired", 400))
    }
    if (req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHander("didn't match", 400))
    }

    user.password = req.body.password
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save()
    sendToken(user, 200, res)

})

// get user details
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id)

    res.status(200).json({
        success: true,
        user
    })
})

// update user password
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id).select("+password")

    // match password
    const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

    if (!isPasswordMatched) {
        return next(new ErrorHander("old password is incorrect", 400))
    }

    if (req.body.newPassword !== req.body.confirmPassword) {
        return next(new ErrorHander("password not matched", 400))
    }

    user.password = req.body.newPassword
    await user.save();

    sendToken(user, 200, res)
})

// update user profile
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
    const newUserData = {
        name: req.body.name,
        email: req.body.email,
    }
    // add avatar later

    const user = await User.findByIdAndUpdate(req.user.id, newUserData, { new: true, runValidators: false, useFindAndModify: false })

    res.status(200).json({
        success: true
    })
})