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

        const cacheKey = `partners:${JSON.stringify(filter)}`;
        const cachedData = await redis.get(cacheKey);
        let allData = cachedData ? JSON.parse(cachedData) : [];

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        if (allData.length < endIndex) {
            const additionalData = await User.find(filter)
                .skip(allData.length)
                .limit(30); // 每次查询30条数据

            allData = allData.concat(additionalData);
            await redis.set(cacheKey, JSON.stringify(allData), 'EX', 3600); // 更新缓存
        }

        const pagedData = allData.slice(startIndex, endIndex);
        const totalCount = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);

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

        res.json({ data: updatedUserProfile });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPartner,
    update,
};
