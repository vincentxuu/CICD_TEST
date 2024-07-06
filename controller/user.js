const User = require("../models/user.model");
const redis = require("../services/redis");

const getPartner = async (req, res, next) => {
    try {
        let { query: { page = 1, pageSize = 30, educationStage, roleList, location, tag, search } } = req;
        page = parseInt(page, 10);
        pageSize = parseInt(pageSize, 10);
        const _id = req.params.id;

        let filter = {};
        if (_id) {
            filter._id = _id;
        }

        if (educationStage) {
            educationStage = educationStage.split(',');
            filter.educationStage = { $in: educationStage };
        }
        if (roleList) {
            roleList = roleList.split(',');
            filter.roleList = { $in: roleList };
        }

        if (location) {
            location = location.split(',');
            filter.location = { $in: location };
        }

        if (tag) {
            tag = tag.split(',');
            filter.tagList = { $in: tag };
        }
        if (search) {
            let searchQuery = {
                $or: [
                    { name: new RegExp(search, 'i') },
                    { selfIntroduction: new RegExp(search, 'i') },
                    { share: new RegExp(search, 'i') },
                    { roleList: new RegExp(search, 'i') },
                    { interestList: new RegExp(search, 'i') },
                    { tagList: new RegExp(search, 'i') },
                ]
            };
            filter = searchQuery;
        }

        // 创建缓存键，只考虑过滤条件，不包括分页信息
        const cacheKey = `partners:${JSON.stringify(filter)}`;
        const cachedData = await redis.get(cacheKey);
        let allData = cachedData ? JSON.parse(cachedData) : [];

        // 计算从缓存中提取数据的起始位置和结束位置
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        // 如果缓存中没有足够的数据，从数据库中查询并更新缓存
        if (allData.length < endIndex) {
            const additionalData = await User.find(filter)
                .skip(allData.length)
                .limit(30); // 每次查询30条数据

            allData = allData.concat(additionalData);
            await redis.set(cacheKey, JSON.stringify(allData), 'EX', 3600); // 更新缓存
        }

        // 提取需要的数据范围
        const pagedData = allData.slice(startIndex, endIndex);
        const totalCount = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);

        // 构建响应
        const response = {
            data: pagedData,
            page,
            pageSize,
            totalCount,
            totalPages,
        };

        res.json(response);
    } catch (error) {
        next(error);
    }
};

const update = async (req, res, next) => {
    try {
        const _id = req.params.id;
        let user = await User.findOne({ _id });

        if (!user) {
            throw new Error("User not found");
        }

        const fieldsToUpdate = [
            'birthDay',
            'contactList',
            'educationStage',
            'email',
            'gender',
            'googleID',
            'name',
            'photoURL',
            'interestList',
            'isOpenLocation',
            'isOpenProfile',
            'isSubscribeEmail',
            'location',
            'roleList',
            'selfIntroduction',
            'share',
            'tagList',
            'wantToDoList'
        ];

        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });

        user.updatedDate = Date.now();

        const updatedUserProfile = await user.save();

        console.log("updatedUserProfile:", updatedUserProfile);

        res.json({ data: updatedUserProfile });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPartner,
    update,
};
