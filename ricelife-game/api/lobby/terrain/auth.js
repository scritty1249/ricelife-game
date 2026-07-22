const DEV_PROD = process.env.NODE_ENV === "development";

export async function GET (request) {
  try {

  } catch (error) {
    console.error(error);
    return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
  }
}

export async function POST (request) {
  try {

  } catch (error) {
    console.error(error);
    return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
  }
}
