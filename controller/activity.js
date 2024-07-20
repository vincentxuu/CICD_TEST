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

        const cacheKey = `activities:${JSON.stringify(filter)}`;
        const cachedData = await redis.get(cacheKey);
        let allData = cachedData ? JSON.parse(cachedData) : [];

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        if (allData.length < endIndex) {
            const additionalData = await Activity.find(filter)
                .skip(allData.length)
                .limit(30); 

            allData = allData.concat(additionalData);
            await redis.set(cacheKey, JSON.stringify(allData), 'EX', 3600); // 更新缓存
        }

        const pagedData = allData.slice(startIndex, endIndex);
        const totalCount = await Activity.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);

        const userIds = Array.from(new Set(pagedData?.map(item => item.userId)));
        const users = await User.find({ _id: { $in: userIds } });

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


const update = async (req, res, next) => {
    try {
        const _id = req.params.id;
        let user = await User.findOne({ _id });
        if (!user) {
            throw new Error("找不到用戶");
        }

        const fieldsToUpdate = [
            'birthDay', 'contactList', 'educationStage', 'email', 'gender', 'googleID',
            'name', 'photoURL', 'interestList', 'isOpenLocation', 'isOpenProfile',
            'isSubscribeEmail', 'location', 'roleList', 'selfIntroduction', 'share',
            'tagList', 'wantToDoList'
        ];

        let isUpdated = false;
        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
                isUpdated = true;
            }
        });

        if (isUpdated) {
            user.updatedDate = Date.now();
            const updatedUserProfile = await user.save();

            // 更新 Redis 快取
            const updateCache = async () => {
                const cacheKey = `partners:${JSON.stringify({ _id })}`;
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    const partners = JSON.parse(cachedData);
                    const index = partners.findIndex(p => p._id.toString() === _id);
                    if (index !== -1) {
                        partners[index] = updatedUserProfile.toObject();
                        await redis.set(cacheKey, JSON.stringify(partners), 'EX', 3600);
                    }
                }

                // 更新用戶特定的快取
                const userCacheKey = `user:${_id}`;
                await redis.set(userCacheKey, JSON.stringify(updatedUserProfile.toObject()), 'EX', 3600);
            };

            // 非同步更新快取，不阻塞響應
            updateCache().catch(console.error);

            res.json({ data: updatedUserProfile, message: "用戶資料已更新" });
        } else {
            res.json({ message: "沒有字段被更新" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '發生錯誤' });
    }
};


const deleteActivity = async (req, res) => {
    try {
        const _id = req.params.id;
        const userId = req.user._id;
        const activity = await Activity.findById(_id);

        if (!activity) {
            return res.status(404).json({ error: "Activity not found" });
        }

        if (activity.userId.toString() !== userId) {
            return res.status(403).json({ error: "You are not authorized to delete this activity" });
        }

        const deletedActivity = await Activity.findByIdAndDelete(_id);

        // Update Redis cache
        const cacheKey = `activities:${JSON.stringify({})}`;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            const activities = JSON.parse(cachedData);
            const updatedActivities = activities.filter(a => a._id.toString() !== _id);
            await redis.set(cacheKey, JSON.stringify(updatedActivities), 'EX', 3600);
        }

        res.status(200).json({ message: 'Activity deleted successfully.' });
    } catch (error) {
        handleErrors(res, error);
    }
};

const changeActivityStatus = async (req, res) => {
    try {
        const _id = req.params.id;
        const userId = req.user._id;

        const activity = await Activity.findById(_id);

        if (!activity) {
            return res.status(404).json({ error: "Activity not found" });
        }

        if (activity.userId.toString() !== userId) {
            return res.status(403).json({ error: "You are not authorized to change the status of this activity" });
        }

        res.status(200).json({ message: 'Activity changed successfully.' });
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
