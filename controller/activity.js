const Activity = require("../models/activity.model");
const User = require("../models/user.model");
const redis = require("../services/redis");

const handleErrors = (res, error) => {
    console.error(error);
    res.status(500).json({ error });
};

const getActivity = async (req, res) => {
    try {
        let { query: { page = 1, pageSize = 30, area, partnerEducationStep, isGrouping, category } } = req;
        page = parseInt(page, 10);
        pageSize = parseInt(pageSize, 10);
        const id = req.params.id;
        const userId = req.params.userId;

        const filter = {};
        if (userId) filter.userId = userId;
        if (id) filter._id = id;
        if (area) filter.area = area;
        if (partnerEducationStep) filter.partnerEducationStep = partnerEducationStep;
        if (isGrouping) filter.isGrouping = isGrouping;
        if (category) filter.category = category;

        // 创建缓存键，只考虑过滤条件，不包括分页信息
        const cacheKey = `activities:${JSON.stringify(filter)}`;
        const cachedData = await redis.get(cacheKey);
        let allData = cachedData ? JSON.parse(cachedData) : [];

        // 计算从缓存中提取数据的起始位置和结束位置
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        // 如果缓存中没有足够的数据，从数据库中查询并更新缓存
        if (allData.length < endIndex) {
            const additionalData = await Activity.find(filter)
                .skip(allData.length)
                .limit(30); // 每次查询30条数据

            allData = allData.concat(additionalData);
            await redis.set(cacheKey, JSON.stringify(allData), 'EX', 3600); // 更新缓存
        }

        // 提取需要的数据范围
        const pagedData = allData.slice(startIndex, endIndex);
        const totalCount = await Activity.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);

        // 获取相关用户信息
        const userIds = Array.from(new Set(pagedData?.map(item => item.userId)));
        const users = await User.find({ _id: { $in: userIds } });

        // 组合活动和用户数据
        const combinedData = pagedData?.map(activityItem => {
            const user = users?.find(userItem => userItem._id?.toString() === activityItem.userId?.toString());
            if (user) {
                return {
                    ...((typeof activityItem.toObject === 'function') ? activityItem.toObject() : activityItem),
                    user: {
                        photoURL: user.photoURL,
                        name: user.name,
                        email: user.email,
                        educationStage: user.educationStage,
                        location: user.location,
                        roleList: user.roleList,
                    },
                };
            } else {
                console.error('User not found for userId:', activityItem.userId);
                return {
                    ...((typeof activityItem.toObject === 'function') ? activityItem.toObject() : activityItem),
                    user: null,
                };
            }
        });

        res.json({
            data: combinedData,
            page,
            pageSize,
            totalCount,
            totalPages,
        });
    } catch (error) {
        handleErrors(res, error);
    }
};

const createActivity = async (req, res) => {
    try {
        const title = req.body.title;
        const existingActivity = await Activity.findOne({ title });

        if (existingActivity) {
            res.json({ message: "Activity already exists" });
        } else {
            const newActivity = new Activity(req.body);
            const data = await newActivity.save();
            res.json({ data });
        }
    } catch (error) {
        handleErrors(res, error);
    }
};

const updateActivity = async (req, res) => {
    try {
        const _id = req.params.id;
        const updatedActivity = await Activity.findByIdAndUpdate(_id, req.body, { new: true });

        if (!updatedActivity) {
            return res.status(404).json({ error: "Activity not found" });
        }

        res.json({
            data: updatedActivity,
        });
    } catch (error) {
        handleErrors(res, error);
    }
};

const deleteActivity = async (req, res) => {
    try {
        const deletedActivity = await Activity.findByIdAndDelete(req.params.id);

        if (!deletedActivity) {
            return res.status(404).json({ error: "Activity not found" });
        }
        res.json({ deletedActivity });
    } catch (error) {
        handleErrors(res, error);
    }
};

const changeActivityStatus = async (req, res) => {
    try {
        const _id = req.params.id;
        console.log("changeActivityStatus", req.body);
        const changeActivityStatus = await Activity.findByIdAndUpdate(_id, req.body);
        if (!changeActivityStatus) {
            return res.status(404).json({ error: "Activity not found" });
        }

        res.json({
            "success": true,
        });
    } catch (error) {
        handleErrors(res, error);
    }
};

module.exports = {
    createActivity,
    getActivity,
    updateActivity,
    deleteActivity,
    changeActivityStatus
};
