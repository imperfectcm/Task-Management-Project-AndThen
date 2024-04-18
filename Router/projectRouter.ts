import { Router, Request, Response } from "express";
import { pgClient } from "../utils/pgClient";
import formidable from "formidable";
import { getTaskRelation } from "../utils/getTaskRelation";

export const projectRouter = Router()

projectRouter.get("/", inspectProject)
projectRouter.post("/", createProject)
projectRouter.put("/", updateProject)
projectRouter.delete("/", deleteProject)

projectRouter.post("/init", initProject)

// request: project id
async function inspectProject(req: Request, res: Response) {
    try {
        const id = req.query.id
        const targetProject = (await pgClient.query(`select * from projects where id = $1`, [id])).rows[0]
        if (targetProject == undefined) {
            res.status(400).json({ message: "Cannot find target project" })
            return
        }
        const tasksOfTargetProject = (await pgClient.query(`select tasks.id, tasks.name, description, pre_req_fulfilled,deadline,start_date,duration,actual_finish_date from projects join tasks on project_id = projects.id where project_id = $1`, [id])).rows
        const usersOfTargetProject = (await pgClient.query(`select username, users.id from projects join user_project_relation on projects.id = project_id join users on users.id = user_id where projects.id = $1`, [id])).rows

        
        for (let task of tasksOfTargetProject) { 
            let taskRelation = await getTaskRelation(id!.toString())
            task.relation = taskRelation
        }

        targetProject.tasks = tasksOfTargetProject
        targetProject.users = usersOfTargetProject

        res.json({ data: targetProject })
        return
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" })
    }

}



// request:project name,project photo -> create new project and project id  (if photo = null, dont pass into backendside
async function createProject(req: Request, res: Response) {
    try {

        const form = formidable({
            uploadDir: __dirname + "/../uploads/Project Photo",
            keepExtensions: true,
            minFileSize: 1,
            maxFiles: 1,
            allowEmptyFiles: true,
            filter: part => part.mimetype?.startsWith('image/') || false
        })


        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.log(err);
                res.status(500).json({ message: "Internal Server Error" });
                return
            }
            
            let image: string
            const id = fields.id![0]
            let projectName = fields.projectName![0]
            if (!files.image) {
                image = ""
            } else {
                image = files.image[0].newFilename
            }

            let newProjectId = (await pgClient.query(`insert into projects (name,image) values ($1,$2) RETURNING id;`, [projectName, image])).rows[0].id
            await pgClient.query(`insert into user_project_relation (user_id,project_id,permission_level) values ($1,$2,1);`, [id, newProjectId])

            res.json({
                message: "created new project",
                data: {
                    id: newProjectId,
                    projectName: projectName,
                    image: image == "" ? null : image
                }
            })
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" })
    }

}

// request: project id, project name?, project photo?
async function updateProject(req: Request, res: Response) {
    try {

        const form = formidable({
            uploadDir: __dirname + "/../uploads/Project Photo",
            keepExtensions: true,
            minFileSize: 0,
            maxFiles: 1,
            allowEmptyFiles: true,
            filter: part => part.mimetype?.startsWith('image/') || false
        })

        form.parse(req, async (err, fields, files) => {
            const id = fields.id![0]
            const projectName = fields.projectName![0]
            const targetProject = (await pgClient.query(`select * from projects where id = $1`, [id])).rows[0]
            if (targetProject == undefined) {
                res.status(400).json({ message: "Cannot find target project" })
                return
            }

            if (files.image) {
                const image = files.image[0].newFilename
                
                await pgClient.query(
                    `UPDATE projects SET name = $1, image = $2 WHERE id = $3;`, [projectName, image, id])
            } else {
                await pgClient.query(
                    `UPDATE projects SET name = $1 WHERE id = $2;`, [projectName, id])
            }
            
            const updatedProjectInfo = (await pgClient.query(`SELECT * FROM projects where id = $1`, [id])).rows[0]
            res.json({ message: "project info updated", data: updatedProjectInfo });
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// request: project id or project name, 
async function deleteProject(req: Request, res: Response) {
    try {
        let id = req.body.id
        const targetProject = (await pgClient.query(`select * from projects where id = $1`, [id])).rows[0]
        if (targetProject == undefined) {
            res.status(400).json({ message: "Cannot find target project" })
            return
        }
        await pgClient.query(`DELETE FROM tasks where project_id = $1`, [id])
        await pgClient.query(`DELETE FROM messages where project_id = $1`, [id])
        await pgClient.query(`DELETE FROM projects where id = $1`, [id])
        await pgClient.query(`DELETE FROM user_project_relation where project_id = $1`, [id])

        res.json({ message: "Delete Successully" })

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error })
    }
}

//******bill testing ******/

async function initProject(req: Request, res: Response) {
    let { projectId, taskName, description, deadline, startDate, duration, preReqTask } = req.body
}