export function createPlayer (userid, username, avatar, team) {
    const instance = {
        data: {
            profile: {
                name: username,
                avatar: avatar,
                fontFamily: "serif",
                userid: userid
            },
            model: "basic", // [!] placeholder
            team: team,
            ammo: [ // [!] placeholder
                "Basic",
                "Flower",
                "Digger",
                "Bouncer",
                "MegaBouncer",
                "GigaBouncer",
                "Pine",
                "Sniper",
                "Rapid",
                "Scatter",
                "MegaScatter",
                "GigaScatter"
            ]
        },
        hitpoints: [  // [!] placeholder
             {
                "type": 0,
                "increase": 1,
                "decrease": 1,
                "amount": 100,
                "regen": 0,
                "max": 100,
                "reserve": 0
            },
            {
                "type": 1,
                "increase": 1,
                "decrease": 1,
                "amount": 20,
                "regen": 3.3333333333333335,
                "max": 20,
                "reserve": 0
            }
        ]
    };
    return instance;
}
