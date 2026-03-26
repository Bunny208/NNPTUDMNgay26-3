var express = require("express");
var router = express.Router();
let { uploadExcel, uploadImage } = require('../utils/uploadHandler')
let path = require('path')
let excelJs = require('exceljs')
let crypto = require('crypto')
let categoriesModel = require('../schemas/categories')
let productsModel = require('../schemas/products')
let inventoriesModel = require('../schemas/inventories')
let usersModel = require('../schemas/users')
let userController = require('../controllers/users')
let { sendUserPasswordMail } = require('../utils/mailHandler')
let mongoose = require('mongoose')
let slugify = require('slugify')

function getCellText(cellValue) {
    if (cellValue === null || cellValue === undefined) {
        return ''
    }
    if (typeof cellValue === 'object') {
        if (cellValue.text) {
            return cellValue.text.toString().trim()
        }
        if (cellValue.hyperlink) {
            return cellValue.hyperlink.toString().trim()
        }
        if (cellValue.result !== undefined && cellValue.result !== null) {
            return cellValue.result.toString().trim()
        }
        if (Array.isArray(cellValue.richText)) {
            return cellValue.richText.map(item => item.text || '').join('').trim()
        }
    }
    return cellValue.toString().trim()
}

router.post('/one_file', uploadImage.single('file'), function (req, res, next) {
    res.send({
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
    })
})
router.post('/multiple_file', uploadImage.array('files', 5), function (req, res, next) {
    console.log(req.body);
    res.send(req.files.map(f => {
        return {
            filename: f.filename,
            path: f.path,
            size: f.size
        }
    }))
})
router.get('/:filename', function (req, res, next) {
    let pathFile = path.join(__dirname, '../uploads', req.params.filename)
    res.sendFile(pathFile)
})
router.post('/excel', uploadExcel.single('file'), async function (req, res, next) {
    //workbook->worksheet->row/column->cell
    let workBook = new excelJs.Workbook();
    let pathFile = path.join(__dirname, '../uploads', req.file.filename)
    await workBook.xlsx.readFile(pathFile)
    let worksheet = workBook.worksheets[0];
    let categories = await categoriesModel.find({})
    let categoriesMap = new Map();
    for (const category of categories) {
        categoriesMap.set(category.name, category.id);
    }
    let getProducts = await productsModel.find({})
    let getSKU = getProducts.map(p => p.sku)
    let getTitle = getProducts.map(p => p.title)
    let result = [];
    for (let index = 2; index <= worksheet.rowCount; index++) {
        let rowError = [];
        const row = worksheet.getRow(index)
        let sku = row.getCell(1).value;
        let title = row.getCell(2).value;
        let category = row.getCell(3).value;
        let price = Number.parseInt(row.getCell(4).value);
        let stock = Number.parseInt(row.getCell(5).value);

        if (price < 0 || isNaN(price)) {
            rowError.push("price phai la so duong")
        }
        if (stock < 0 || isNaN(stock)) {
            rowError.push("stock phai la so duong")
        }
        if (!categoriesMap.has(category)) {
            rowError.push("category khong hop le")
        }
        if (getSKU.includes(sku)) {
            rowError.push("sku da ton tai")
        }
        if (getTitle.includes(title)) {
            rowError.push("title da ton tai")
        }
        if (rowError.length > 0) {
            result.push({
                success: false,
                data: rowError
            })
            continue;
        }
        let session = await mongoose.startSession();
        session.startTransaction()
        try {
            let newProduct = new productsModel({
                sku: sku,
                title: title,
                slug: slugify(title, {
                    replacement: '-',
                    remove: undefined,
                    lower: true,
                    strict: true
                }),
                price: price,
                description: title,
                category: categoriesMap.get(category),
            })
            await newProduct.save({ session })
            let newInventory = new inventoriesModel({
                product: newProduct._id,
                stock: stock
            })
            await newInventory.save({ session })
            await newInventory.populate('product')
            await session.commitTransaction();
            await session.endSession()
            result.push({
                success: true,
                data: newInventory
            })
        } catch (error) {
            await session.abortTransaction();
            await session.endSession()
            result.push({
                success: false,
                data: error.message
            })
        }
    }
    res.send(result)
})
router.post('/excel/users', uploadExcel.single('file'), async function (req, res, next) {
    try {
        let workBook = new excelJs.Workbook();
        let pathFile = path.join(__dirname, '../uploads', req.file.filename)
        await workBook.xlsx.readFile(pathFile)
        let worksheet = workBook.worksheets[0];

        if (!worksheet || worksheet.rowCount < 2) {
            return res.status(400).send({
                message: 'file excel khong co du lieu'
            })
        }

        let existingUsers = await usersModel.find({
            isDeleted: false
        }).select('username email')
        let usernameSet = new Set(existingUsers.map(item => item.username))
        let emailSet = new Set(existingUsers.map(item => item.email))
        let existingUsersByUsername = new Map(existingUsers.map(item => [item.username, item]))
        let existingUsersByEmail = new Map(existingUsers.map(item => [item.email, item]))
        let fileUsernameSet = new Set()
        let fileEmailSet = new Set()
        let result = [];

        for (let index = 2; index <= worksheet.rowCount; index++) {
            let row = worksheet.getRow(index)
            let username = getCellText(row.getCell(1).value)
            let email = getCellText(row.getCell(2).value).toLowerCase()
            let rowError = [];

            if (!username) {
                rowError.push('username khong duoc de trong')
            }
            if (!email) {
                rowError.push('email khong duoc de trong')
            }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                rowError.push('email sai dinh dang')
            }
            let existingByUsername = existingUsersByUsername.get(username)
            let existingByEmail = existingUsersByEmail.get(email)
            let matchedExistingUser = null

            if (existingByUsername && existingByEmail) {
                if (existingByUsername._id.toString() !== existingByEmail._id.toString()) {
                    rowError.push('username va email dang thuoc 2 user khac nhau')
                } else {
                    matchedExistingUser = existingByUsername
                }
            } else if (existingByUsername || existingByEmail) {
                rowError.push('username hoac email da ton tai nhung khong cung 1 user')
            }

            if (!matchedExistingUser && fileUsernameSet.has(username)) {
                rowError.push('username bi trung trong file')
            }
            if (!matchedExistingUser && fileEmailSet.has(email)) {
                rowError.push('email bi trung trong file')
            }

            if (rowError.length > 0) {
                result.push({
                    success: false,
                    row: index,
                    data: rowError
                })
                continue;
            }

            let password = crypto.randomBytes(12).toString('base64').slice(0, 16);

            try {
                let savedUser = null
                let action = 'created'
                if (matchedExistingUser) {
                    matchedExistingUser.password = password
                    await matchedExistingUser.save()
                    savedUser = matchedExistingUser
                    action = 'updated_password'
                } else {
                    savedUser = await userController.CreateAnUser(
                        username,
                        password,
                        email
                    )
                }
                let mailSent = true
                let mailError = null
                try {
                    await sendUserPasswordMail(email, username, password)
                } catch (error) {
                    mailSent = false
                    mailError = error.message
                }

                usernameSet.add(username)
                emailSet.add(email)
                existingUsersByUsername.set(username, savedUser)
                existingUsersByEmail.set(email, savedUser)
                if (!matchedExistingUser) {
                    fileUsernameSet.add(username)
                    fileEmailSet.add(email)
                }

                result.push({
                    success: true,
                    row: index,
                    data: {
                        _id: savedUser._id,
                        username: savedUser.username,
                        email: savedUser.email,
                        action: action,
                        mailSent: mailSent,
                        mailError: mailError
                    }
                })
            } catch (error) {
                result.push({
                    success: false,
                    row: index,
                    data: error.message
                })
            }
        }

        res.send(result)
    } catch (error) {
        res.status(400).send({
            message: error.message
        })
    }
})
module.exports = router;
