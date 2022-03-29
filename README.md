
# Omnivox (LED3D)

A 3D LED display server and client made to drive fun and novel visualizations.

## Deployment

- Run `npm install` to get all the required node packages.
- Run `npm run dev|prod` for dev or production mode (leave this running for the watch).
- In parallel, run `npm start` to run server.js in production, or `npm run start_dev` to use nodemon while running the server during development.
- Navigate to http://locahost:4000/controller and http://localhost:4000/viewer have fun!


## Controller
COMING SOON

### Basic Mode (No context button held down)
- Left analog stick – Moves the cursor: Up/down is the y-axis, left/right is the x-axis
- Right analog stick – Moves the cursor: Up/down is the z-axis
- ??? – Expanding sphere (single event)
- ??? – Shoot a light in the direction you were travelling in, or random direction and speed (dependant on music) if still (max 8 lights)
- Right trigger - Excrete a sphere of expanding fog, with density dependant on how far down the trigger is pressed
- Left trigger - Paint a line, line density depends on how far down the trigger is pressed, line fades over time

### Left Bumper Context Mode

### Right Bumper Context Mode


## Authors

- Team Lead: Callum Hay ([@callumhay](https://github.com/callumhay))
- Software and Hardware Design and Development: Callum Hay
- Prototyping and Physical Design: Sara Vinten and Callum Hay
- Modeling and Construction: Sara Vinten and Callum Hay
- Laser Cutting and CnC Assistance: Trish Lamanna, Timothy Wyatt, and Michael Everson
- Original Idea and Ongoing Ideation: Callum Hay, Sara Vinten, Mikhail St. Denis, and Michael Everson